import { createDatabasePool } from './database.js';

console.info(`Node ${process.version}`);
console.info(`Gemini key configured: ${process.env.GEMINI_API_KEY ? 'yes' : 'no (offline mode is supported)'}`);
console.info(`Demo reviewer configured: ${process.env.DEMO_REVIEWER_EMAIL && process.env.DEMO_REVIEWER_PASSWORD ? 'yes' : 'no'}`);

const pool = createDatabasePool();
try {
  await pool.query('SELECT 1');
  console.info('PostgreSQL: reachable');
  const migration = await pool.query<{ version: string }>("SELECT version FROM schema_migrations WHERE version = '001_initial.sql'");
  console.info(`Initial migration: ${migration.rows[0] ? 'applied' : 'not applied'}`);
} catch {
  console.info('PostgreSQL: not reachable or migrations not yet applied');
} finally {
  await pool.end();
}
