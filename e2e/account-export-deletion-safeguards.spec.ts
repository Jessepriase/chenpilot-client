import { test, expect } from '@playwright/test';

/**
 * Account export and deletion safeguards (#556).
 *
 * Deterministic testnet fixtures and intercepted routes only. These specs
 * verify that destructive actions require a fresh reauthentication and an
 * explicit typed confirmation, that failures are recoverable, and that no
 * sensitive value ever appears in a URL.
 */

const TEST_USER = {
  id: 'usr-testnet-safeguards',
  email: 'safeguards.contributor@example.test',
  name: 'Safeguards Pilot',
  address: 'GBRPYHIL2CI3FNQ4AFIXFKVKGMWVDWDBCAGA6XVZZDAML7THV7CANUBB',
  publicKey: 'GBRPYHIL2CI3FNQ4AFIXFKVKGMWVDWDBCAGA6XVZZDAML7THV7CANUBB',
  tokenType: 'XLM',
  authProvider: 'email',
  isDeployed: true,
  isFunded: true,
  isEmailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const TEST_PASSWORD = 'testnet-only-password';

function assertNoSensitiveValuesInUrl(url: string) {
  expect(url).not.toContain(TEST_USER.email);
  expect(url).not.toContain(TEST_PASSWORD);
  expect(url).not.toContain('token=');
  expect(url).not.toContain('secret=');
}

test.describe('Account export and deletion safeguards (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      window.localStorage.setItem('auth_token', 'mock-testnet-safeguards-token');
      window.localStorage.setItem('user_data', JSON.stringify(user));
    }, TEST_USER);

    await page.route('**/auth/reauthenticate', async (route) => {
      const body = (route.request().postDataJSON() ?? {}) as { password?: string };
      if (body.password === TEST_PASSWORD) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              authenticatedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 300000).toISOString(),
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Incorrect password' }),
      });
    });

    await page.route('**/account/*/transactions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { transactions: [], total: 0, page: 1, limit: 10 },
        }),
      });
    });
  });

  test('export requires reauthentication and keeps secrets out of the URL', async ({ page }) => {
    let exportRequests = 0;
    await page.route('**/data-export', async (route) => {
      exportRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: 'testnet-export-placeholder',
      });
    });

    await page.goto('/settings');
    const download = page.waitForEvent('download').catch(() => null);
    await page.getByRole('button', { name: /export (my )?data/i }).click();

    // A step-up challenge stands between the click and any export request.
    await expect(
      page.getByRole('dialog', { name: /reauthenticate|confirm your password/i }),
    ).toBeVisible();
    expect(exportRequests).toBe(0);

    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /confirm|verify/i }).click();
    await download;

    expect(exportRequests).toBe(1);
    assertNoSensitiveValuesInUrl(page.url());
  });

  test('deletion stays disabled until the exact email is typed and survives a server failure', async ({ page }) => {
    let deleteAttempts = 0;
    await page.route('**/auth/account', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      deleteAttempts += 1;
      if (deleteAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Deletion temporarily unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { message: 'Account deleted' } }),
      });
    });

    await page.goto('/settings');
    const confirmation = page.getByLabel(/type your email to confirm deletion/i);
    const deleteButton = page.getByRole('button', { name: /delete (my )?account/i });

    await confirmation.fill(TEST_USER.email.slice(0, -1));
    await expect(deleteButton).toBeDisabled();

    await confirmation.fill(TEST_USER.email.toUpperCase());
    await expect(deleteButton).toBeEnabled();

    await deleteButton.click();
    await expect(
      page.getByRole('dialog', { name: /reauthenticate|confirm your password/i }),
    ).toBeVisible();
    expect(deleteAttempts).toBe(0);

    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /confirm|verify/i }).click();

    await expect(page.getByText(/deletion temporarily unavailable/i).first()).toBeVisible();
    expect(deleteAttempts).toBe(1);

    // Recovery: the typed confirmation is still present and the user can retry
    // without re-entering their password while the step-up remains fresh.
    await expect(confirmation).toHaveValue(TEST_USER.email.toUpperCase());
    await deleteButton.click();
    await expect(page.getByText(/account deleted/i).first()).toBeVisible();
    expect(deleteAttempts).toBe(2);
    assertNoSensitiveValuesInUrl(page.url());
  });
});
