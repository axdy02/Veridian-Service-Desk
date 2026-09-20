import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabasePool } from './database.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDirectory = join(projectRoot, 'migrations');
const pool = createDatabasePool();

try {
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const appliedResult = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.version));
    const files = (await readdir(migrationsDirectory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const migration = await readFile(join(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(migration);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.info(`Applied migration ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    if (files.every((file) => applied.has(file))) console.info('Database migrations are already current.');
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
