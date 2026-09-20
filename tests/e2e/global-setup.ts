/*
 * Playwright global setup: recreates the isolated e2e PostgreSQL database (name carries a
 * `_test` suffix) and applies the migrations. The developer's working database is never
 * touched, and no Gemini key is required: the suite always runs the labelled offline mode.
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

export const E2E_TEST_DB = `${process.env.POSTGRES_DB?.trim() || 'veridian_service_desk'}_e2e_test`;

export default async function globalSetup(): Promise<void> {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const admin = new Pool({
    host: process.env.POSTGRES_HOST?.trim() || 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432) || 5432,
    user: process.env.POSTGRES_USER?.trim() || 'veridian_local',
    password: process.env.POSTGRES_PASSWORD || undefined,
    database: 'postgres'
  });
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${E2E_TEST_DB}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${E2E_TEST_DB}"`);
  } finally {
    await admin.end();
  }

  const pool = new Pool({
    host: process.env.POSTGRES_HOST?.trim() || 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432) || 5432,
    user: process.env.POSTGRES_USER?.trim() || 'veridian_local',
    password: process.env.POSTGRES_PASSWORD || undefined,
    database: E2E_TEST_DB
  });
  try {
    const migrationFiles = (await readdir(join(projectRoot, 'migrations')))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort();
    for (const file of migrationFiles) {
      const sql = await readFile(join(projectRoot, 'migrations', file), 'utf8');
      await pool.query(sql);
    }
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', migrationFiles.map((file) => [file]).flat());
  } finally {
    await pool.end();
  }
}
