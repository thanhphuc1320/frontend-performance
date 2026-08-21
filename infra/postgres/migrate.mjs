import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const directory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(directory, 'migrations');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:commerce_local@127.0.0.1:55432/commerce';

async function migrationFiles(direction) {
  const suffix = direction === 'up' ? '.sql' : '.down.sql';
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(suffix) && (direction === 'down' || !file.endsWith('.down.sql')))
    .sort();
  return direction === 'up' ? files : files.reverse();
}

async function migrate(direction) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const file of await migrationFiles(direction)) {
      const version = file.split('_', 1)[0];
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version],
      );
      if (direction === 'up' && applied.rowCount > 0) continue;
      if (direction === 'down' && applied.rowCount === 0) continue;

      const sql = await readFile(join(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        if (sql.trim()) await client.query(sql);
        if (direction === 'up') {
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        } else {
          await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

const direction = process.argv[2];
if (direction !== 'up' && direction !== 'down') {
  console.error('Usage: node infra/postgres/migrate.mjs <up|down>');
  process.exitCode = 1;
} else {
  migrate(direction).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
