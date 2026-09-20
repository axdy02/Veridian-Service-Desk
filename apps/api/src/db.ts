import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { config } from './config.js';

const pool = new Pool(
  config.databaseUrl
    ? { connectionString: config.databaseUrl, ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined }
    : {
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
        ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined
      }
);

pool.on('error', () => {
  // A checked-out connection can fail after an API response. Requests surface a
  // redacted availability error instead of emitting connection details.
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
) {
  return pool.query<T>(text, values as unknown[]);
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original error is more useful and is safely converted at the boundary.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseReady(): Promise<boolean> {
  try {
    const result = await query<{ applied: number }>(
      "SELECT count(*)::int AS applied FROM schema_migrations WHERE version = '001_initial.sql'"
    );
    return result.rows[0]?.applied === 1;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

export function isSerializationFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && ['40001', '23505'].includes(String((error as { code?: string }).code));
}
