import { expect, type Page } from '@playwright/test';

export const webOrigin = 'http://localhost:3100';
export const apiOrigin = 'http://127.0.0.1:3101';

/**
 * Creates a fresh account through the API and returns the session cookie, so a test can
 * enter the workspace in a signed-in browser context without repeating slow UI setup.
 * Every signup receives its own isolated seeded workspace. Signup is the only auth call
 * made this way, which keeps the API's auth rate limit far below its threshold.
 */
export async function signupAccount(label: string): Promise<{ email: string; password: string; cookie: { name: string; value: string; domain: string; path: string } }> {
  const email = `${label}-${Date.now()}@veridian.local`;
  const password = `offline-e2e-password-${label}`.replace(/[^a-zA-Z0-9-]/g, '') + '!';
  const response = await fetch(`${apiOrigin}/api/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: webOrigin,
      'x-vds-request': '1'
    },
    body: JSON.stringify({ displayName: `E2E ${label}`, email, password })
  });
  if (response.status !== 201) {
    throw new Error(`Signup for ${label} failed with status ${response.status}: ${await response.text()}`);
  }
  const setCookie = response.headers.getSetCookie().find((value) => value.startsWith('vds_session='));
  if (!setCookie) throw new Error(`Signup for ${label} did not return a session cookie.`);
  const token = setCookie.split(';')[0].split('=')[1];
  return {
    email,
    password,
    cookie: { name: 'vds_session', value: token, domain: 'localhost', path: '/' }
  };
}

/** Opens the inbox for a signed-in account and returns the case URL for a source id. */
export async function caseUrlFor(page: Page, sourceId: string): Promise<string> {
  await page.goto(`${webOrigin}/inbox`);
  const link = page.locator('a.source-link', { hasText: sourceId }).first();
  await expect(link).toBeVisible();
  return link.getAttribute('href') as Promise<string>;
}

/** Collects page errors and console errors so a test can assert the UI stayed clean. */
export function collectBrowserErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return () => errors;
}
