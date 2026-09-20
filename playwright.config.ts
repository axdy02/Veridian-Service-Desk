import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

// The e2e suite reads the local database credentials from the repository-root .env.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env'), override: false, quiet: true });

const e2eTestDb = `${process.env.POSTGRES_DB?.trim() || 'veridian_service_desk'}_e2e_test`;
const apiPort = 3101;
const webPort = 3100;
const admin = {
  host: process.env.POSTGRES_HOST?.trim() || 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432) || 5432,
  user: process.env.POSTGRES_USER?.trim() || 'veridian_local',
  password: process.env.POSTGRES_PASSWORD || undefined
};
const e2eDatabaseUrl = `postgresql://${encodeURIComponent(admin.user)}:${encodeURIComponent(admin.password ?? '')}@${admin.host}:${admin.port}/${e2eTestDb}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Serial execution keeps the API's per-IP auth rate limit comfortable and the run deterministic.
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results/e2e-artifacts',
  use: {
    baseURL: `http://localhost:${webPort}`,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npx tsx src/index.ts',
      cwd: 'apps/api',
      url: `http://127.0.0.1:${apiPort}/api/health/live`,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(apiPort),
        AGENT_MODE: 'offline',
        APP_ORIGIN: `http://localhost:${webPort}`,
        COOKIE_SECURE: 'false',
        DATABASE_URL: e2eDatabaseUrl,
        // The suite creates many accounts and runs from one test IP; the documented
        // production caps (10 auth / 30 agent per 10 minutes) remain the defaults.
        AUTH_MAX: '60',
        AGENT_MAX: '200'
      }
    },
    {
      command: `npx next dev -p ${webPort}`,
      cwd: 'apps/web',
      url: `http://localhost:${webPort}/login`,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        API_INTERNAL_ORIGIN: `http://127.0.0.1:${apiPort}`
      }
    }
  ]
});
