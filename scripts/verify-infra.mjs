import pg from 'pg';
import { createClient } from 'redis';
import { spawn } from 'node:child_process';
import './load-env.cjs';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:commerce_local@127.0.0.1:55432/commerce';
const redisUrl = process.env.REDIS_URL ?? 'redis://:commerce_local@127.0.0.1:56379';
const { Client } = pg;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
  });
}

async function postgresChecks() {
  await run('node', ['infra/postgres/migrate.mjs', 'up']);
  await run('node', ['infra/postgres/migrate.mjs', 'up']);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let sentinelInserted = false;
  try {
    await client.query('SELECT 1');
    const metadataTable = await client.query("SELECT to_regclass('public.schema_migrations') AS name");
    if (metadataTable.rows[0].name !== 'schema_migrations') throw new Error('schema_migrations table is missing');
    const sentinel = await client.query("SELECT 1 FROM schema_migrations WHERE version = 'sentinel'");
    if (sentinel.rowCount === 0) {
      await client.query("INSERT INTO schema_migrations (version) VALUES ('sentinel')");
      sentinelInserted = true;
    }
    const before = await client.query('SELECT version FROM schema_migrations WHERE version IN ($1, $2) ORDER BY version', ['0001', '0002']);
    if (before.rowCount !== 2) throw new Error('Auth/Store/RBAC migrations are not recorded exactly once');
    const sentinelBefore = await client.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1', ['sentinel']);
    if (sentinelBefore.rows[0].count !== 1) throw new Error('sentinel migration record was not created');
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'");
    if (tables.rowCount !== 9) throw new Error('Auth/Store/RBAC schema is incomplete');
    await run('node', ['infra/postgres/migrate.mjs', 'down']);
    const metadataAfter = await client.query("SELECT to_regclass('public.schema_migrations') AS name");
    if (metadataAfter.rows[0].name !== 'schema_migrations') throw new Error('rollback removed schema_migrations');
    const after = await client.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version IN ($1, $2)', ['0001', '0002']);
    if (after.rows[0].count !== 0) throw new Error('rollback did not remove the Auth/Store/RBAC migration records');
    const sentinelAfter = await client.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1', ['sentinel']);
    if (sentinelAfter.rows[0].count !== 1) throw new Error('rollback removed an unrelated migration record');
    const tablesAfter = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'");
    if (tablesAfter.rowCount !== 0) throw new Error('business tables exist after rollback');
    await run('node', ['infra/postgres/migrate.mjs', 'up']);
    const restored = await client.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version IN ($1, $2)', ['0001', '0002']);
    if (restored.rows[0].count !== 2) throw new Error('Auth/Store/RBAC migrations were not restored');
  } finally {
    if (sentinelInserted) {
      await client.query("DELETE FROM schema_migrations WHERE version = 'sentinel'").catch(() => {});
    }
    await client.end();
  }
}

async function redisChecks() {
  const client = createClient({ url: redisUrl });
  await client.connect();
  try {
    if ((await client.ping()) !== 'PONG') throw new Error('Redis did not respond with PONG');
  } finally {
    await client.quit();
  }
}

try {
  await postgresChecks();
  await redisChecks();
  console.log('Infrastructure verification passed.');
} catch (error) {
  console.error(`Infrastructure verification failed: ${error.message}`);
  process.exitCode = 1;
}
