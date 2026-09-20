import 'dotenv/config';
import { Pool } from 'pg';

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback;
}

export function createDatabasePool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) return new Pool({ connectionString });
  return new Pool({
    host: process.env.POSTGRES_HOST?.trim() || 'localhost',
    port: numberEnv('POSTGRES_PORT', 5432),
    database: process.env.POSTGRES_DB?.trim() || 'veridian_service_desk',
    user: process.env.POSTGRES_USER?.trim() || 'veridian_local',
    password: process.env.POSTGRES_PASSWORD
  });
}
