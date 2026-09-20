import { expect, test } from '@playwright/test';
import { collectBrowserErrors, signupAccount, webOrigin } from './helpers';

test.describe('signup, login, logout and guarded routes', () => {
  test('new signup creates a seeded private workspace with all source records', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    const account = await signupAccount('nav');
    await page.addInitScript(() => undefined);
    await page.context().addCookies([account.cookie]);

    await page.goto(`${webOrigin}/inbox`);
    await expect(page.locator('h1')).toHaveText('Inbox');
    await expect(page.locator('.case-table tbody tr')).toHaveCount(25);

    const cards = page.locator('.count-card');
    await expect(cards.filter({ hasText: 'Source requests' }).locator('strong')).toHaveText('15');
    await expect(cards.filter({ hasText: 'Active source tickets' }).locator('strong')).toHaveText('4');
    await expect(cards.filter({ hasText: 'Closed history' }).locator('strong')).toHaveText('6');

    for (const [path, heading] of [
      ['/tickets', 'Tickets'],
      ['/knowledge', 'Knowledge'],
      ['/audit', 'Audit trail'],
      ['/settings', 'Settings']
    ] as const) {
      await page.goto(`${webOrigin}${path}`);
      await expect(page.locator('h1')).toHaveText(heading);
    }

    expect(errors()).toEqual([]);
  });

  test('unauthenticated visitors are redirected to sign-in', async ({ page }) => {
    await page.goto(`${webOrigin}/inbox`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('signup form validates inline and never offers a fake password recovery link', async ({ page }) => {
    await page.goto(`${webOrigin}/signup`);
    await expect(page.getByText(/forgot password/i)).toHaveCount(0);
    await page.getByLabel('Display name').fill('Inline Validation');
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByLabel('Password', { exact: false }).fill('short');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Use at least 12 characters for your password.')).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('login with wrong credentials shows an error and stays on the form', async ({ page }) => {
    await page.goto(`${webOrigin}/login`);
    await page.getByLabel('Email address').fill('nobody@veridian.local');
    await page.getByLabel('Password', { exact: false }).fill('wrong-password-long');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('.form-alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout returns the browser to the sign-in screen and revokes the session', async ({ page }) => {
    const account = await signupAccount('logout');
    await page.context().addCookies([account.cookie]);
    await page.goto(`${webOrigin}/inbox`);
    await page.locator('.user-menu-button').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto(`${webOrigin}/inbox`);
    await expect(page).toHaveURL(/\/login/);
  });
});
