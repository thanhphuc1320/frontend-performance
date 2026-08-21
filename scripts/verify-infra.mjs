import pg from 'pg';
import { createClient } from 'redis';
import { spawn } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:55432/commerce';
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:56379';
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
  try {
    await client.query('SELECT 1');
    const before = await client.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1', ['0001']);
    if (before.rows[0].count !== 1) throw new Error('baseline migration is not recorded exactly once');
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'");
    if (tables.rowCount !== 0) throw new Error('business tables exist in the empty baseline');
    await run('node', ['infra/postgres/migrate.mjs', 'down']);
    const after = await client.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1', ['0001']);
    if (after.rows[0].count !== 0) throw new Error('rollback did not remove the baseline migration record');
    await run('node', ['infra/postgres/migrate.mjs', 'up']);
    const restored = await client.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version = $1', ['0001']);
    if (restored.rows[0].count !== 1) throw new Error('baseline migration was not restored');
  } finally {
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
