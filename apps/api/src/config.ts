import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = fileURLToPath(new URL('.', import.meta.url));

// Local development reads the repository-root .env (documented in README). Environment
// variables that are already set — for example the values Docker Compose injects — always win.
dotenv.config({ path: resolve(apiDirectory, '../../../.env'), override: false, quiet: true });

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function boolFromEnv(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

const configuredAgentMode = process.env.AGENT_MODE?.trim().toLowerCase();

export const config = {
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  port: intFromEnv('PORT', intFromEnv('API_PORT', 3001, 1, 65535), 1, 65535),
  appOrigin: process.env.APP_ORIGIN?.trim() || 'http://localhost:3000',
  // Docker Compose supplies POSTGRES_HOST=postgres. Keeping this explicit means the API never
  // relies on a container's localhost to reach PostgreSQL.
  databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  postgres: {
    host: process.env.POSTGRES_HOST?.trim() || process.env.PGHOST?.trim() || 'postgres',
    port: intFromEnv('POSTGRES_PORT', intFromEnv('PGPORT', 5432, 1, 65535), 1, 65535),
    database: process.env.POSTGRES_DB?.trim() || process.env.PGDATABASE?.trim() || 'veridian',
    user: process.env.POSTGRES_USER?.trim() || process.env.PGUSER?.trim() || 'veridian',
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || undefined,
    ssl: boolFromEnv('PGSSLMODE_REQUIRE')
  },
  sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || 'vds_session',
  sessionHours: intFromEnv('SESSION_TTL_HOURS', intFromEnv('SESSION_HOURS', 8, 1, 168), 1, 168),
  // HTTP localhost is deliberately supported for the normal local development flow.
  cookieSecure: boolFromEnv('COOKIE_SECURE', process.env.NODE_ENV === 'production'),
  agentMode: configuredAgentMode === 'gemini' || configuredAgentMode === 'offline' ? configuredAgentMode : 'auto',
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
  dataDirectory: process.env.VERIDIAN_DATA_DIR?.trim() || resolve(apiDirectory, '../../../data'),
  maxJsonBytes: '64kb',
  // Defaults keep the documented local behaviour. The e2e suite raises the caps through env
  // because many accounts are created from one test IP; production values are unchanged.
  rateLimits: {
    authWindowMs: intFromEnv('AUTH_WINDOW_MS', 10 * 60 * 1000, 1000, 3_600_000),
    authMax: intFromEnv('AUTH_MAX', 10, 1, 1000),
    agentWindowMs: intFromEnv('AGENT_WINDOW_MS', 10 * 60 * 1000, 1000, 3_600_000),
    agentMax: intFromEnv('AGENT_MAX', 30, 1, 1000)
  }
} as const;

export function runtimeMode(): 'gemini' | 'offline' {
  return config.agentMode === 'gemini' || (config.agentMode === 'auto' && config.geminiApiKey)
    ? 'gemini'
    : 'offline';
}
