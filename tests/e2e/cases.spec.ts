import { expect, test } from '@playwright/test';
import { caseUrlFor, collectBrowserErrors, signupAccount, webOrigin } from './helpers';

test.describe('case workflows in the browser (offline mode)', () => {
  let account: Awaited<ReturnType<typeof signupAccount>>;

  test.beforeAll(async () => {
    account = await signupAccount('flows');
  });

  test('guest Wi-Fi question records guidance with evidence and no ticket (REQ-02)', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.context().addCookies([account.cookie]);
    await page.goto(await caseUrlFor(page, 'REQ-02'));

    await page.getByRole('button', { name: 'Run analysis' }).click();
    const decision = page.locator('.decision-panel');
    await expect(decision).toContainText('Guest Wifi');
    await expect(decision).toContainText('front-desk kiosk');

    const evidence = page.locator('.evidence-panel');
    await expect(evidence).toContainText('KB-07');

    await expect(page.locator('.ticket-panel')).toContainText('No local ticket has been created for this case.');
    expect(errors()).toEqual([]);
    await page.screenshot({ path: 'test-results/screenshots/req02-guidance-no-ticket.png', fullPage: true });
  });

  test('laptop request surfaces both conflicting sources side by side (REQ-01)', async ({ page }) => {
    await page.context().addCookies([account.cookie]);
    await page.goto(await caseUrlFor(page, 'REQ-01'));

    await page.getByRole('button', { name: 'Run analysis' }).click();
    const conflict = page.locator('.conflict-panel');
    await expect(conflict).toContainText('KB-03');
    await expect(conflict).toContainText('ASSET-01');
    await expect(conflict).toContainText('neither has a stated precedence');

    const decision = page.locator('.decision-panel');
    await expect(decision).toContainText('Human Review');
    await expect(page.locator('.ticket-panel')).toContainText(/VDS-/);
    await page.screenshot({ path: 'test-results/screenshots/req01-policy-conflict.png', fullPage: true });
  });

  test('phishing escalation stays with Security and does not close (REQ-08)', async ({ page }) => {
    await page.context().addCookies([account.cookie]);
    await page.goto(await caseUrlFor(page, 'REQ-08'));

    await page.getByRole('button', { name: 'Run analysis' }).click();
    const decision = page.locator('.decision-panel');
    await expect(decision).toContainText('Security Escalation Already Open');
    await expect(decision).toContainText('Security');
  });

  test('historical records are read-only (TK-1042)', async ({ page }) => {
    await page.context().addCookies([account.cookie]);
    await page.goto(await caseUrlFor(page, 'TK-1042'));

    await expect(page.locator('.history-callout')).toContainText('Historical record — no action required.');
    await expect(page.locator('.history-badge')).toHaveText('History');
    await expect(page.getByLabel('Follow-up input')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Run analysis' })).toBeDisabled();
    await page.screenshot({ path: 'test-results/screenshots/closed-history-readonly.png', fullPage: true });
  });

  test('inbox filters narrow the case table', async ({ page }) => {
    await page.context().addCookies([account.cookie]);
    await page.goto(`${webOrigin}/inbox`);

    await page.getByLabel('Search cases').fill('REQ-01');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.case-table tbody tr')).toHaveCount(1);

    // The historical scope always contains the six immutable closed source tickets.
    // Earlier tests may additionally have closed self-service cases, so only the six
    // supplied TK records are asserted here.
    await page.getByLabel('Search cases').fill('');
    await page.getByLabel('Current state').selectOption('history');
    await page.getByRole('button', { name: 'Apply' }).click();
    for (const closedId of ['TK-1042', 'TK-1045', 'TK-1046', 'TK-1049', 'TK-1050', 'TK-1051']) {
      await expect(page.locator('.case-table tbody tr').filter({ hasText: closedId })).toHaveCount(1);
    }
  });

  test('audit trail records the actual workflow events', async ({ page }) => {
    await page.context().addCookies([account.cookie]);
    // Produce a fresh run in this test so it passes standalone and in the full suite.
    await page.goto(await caseUrlFor(page, 'REQ-13'));
    await page.getByRole('button', { name: 'Run analysis' }).click();
    await expect(page.locator('.decision-panel')).toContainText(/Laptop|Human Review/);

    await page.goto(`${webOrigin}/audit`);
    await expect(page.locator('.audit-event').first()).toBeVisible();
    const body = page.locator('.audit-list');
    await expect(body).toContainText('Workspace Seeded');
    await expect(body).toContainText('Account Created');
    await expect(body).toContainText('Run Reserved');
    await expect(body).toContainText('Node Started');
  });
});

test.describe('multi-turn conversations and isolation', () => {
  test('extension clarification continues to Security routing after a follow-up (REQ-14)', async ({ page }) => {
    const account = await signupAccount('multiturn');
    await page.context().addCookies([account.cookie]);
    await page.goto(await caseUrlFor(page, 'REQ-14'));

    await page.getByRole('button', { name: 'Run analysis' }).click();
    await expect(page.locator('.decision-panel')).toContainText('approved catalog');
    await expect(page.locator('.questions')).toBeVisible();

    await page.getByLabel('Follow-up input').fill('The extension is called FocusTrack and it is not in the software catalog.');
    await page.getByRole('button', { name: 'Send follow-up' }).click();
    const decision = page.locator('.decision-panel');
    await expect(decision).toContainText('Human Review');
    await expect(decision).toContainText('Security');
  });

  test('employee confirmation closes a self-service VPN case (REQ-05)', async ({ page }) => {
    const account = await signupAccount('confirm');
    await page.context().addCookies([account.cookie]);
    await page.goto(await caseUrlFor(page, 'REQ-05'));

    await page.getByRole('button', { name: 'Run analysis' }).click();
    await expect(page.locator('.decision-panel')).toContainText('renew');

    await page.getByLabel('Follow-up input').fill('I renewed my VPN credentials and the issue is resolved.');
    await page.getByRole('button', { name: 'Send follow-up' }).click();
    await expect(page.locator('.case-toolbar-status')).toContainText('Resolved');
  });

  test('a second account cannot open another workspace case', async ({ page, browser }) => {
    const first = await signupAccount('isolation-a');
    const second = await signupAccount('isolation-b');
    await page.context().addCookies([first.cookie]);
    const url = await caseUrlFor(page, 'REQ-02');

    const secondContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await secondContext.addCookies([{ name: second.cookie.name, value: second.cookie.value, url: webOrigin }]);
    const secondPage = await secondContext.newPage();
    const errors = collectBrowserErrors(secondPage);
    await secondPage.goto(`${webOrigin}${url}`);
    await expect(secondPage.locator('.state-error')).toBeVisible();
    await expect(secondPage.locator('.state-error')).toContainText('was not found');
    // The deliberate 404 also logs a browser network message; any other console error is a defect.
    const realErrors = errors().filter((message) => !message.includes('404 (Not Found)'));
    expect(realErrors).toEqual([]);
    await secondContext.close();
  });
});

test.describe('mobile layout (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sidebar becomes a drawer and the page does not overflow horizontally', async ({ page }) => {
    const account = await signupAccount('mobile');
    await page.context().addCookies([account.cookie]);
    await page.goto(`${webOrigin}/inbox`);

    const menu = page.getByRole('button', { name: 'Open navigation' });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.getByRole('button', { name: 'Close navigation' }).click();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({ path: 'test-results/screenshots/mobile-inbox.png', fullPage: false });
  });
});
