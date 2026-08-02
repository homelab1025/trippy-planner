import { test, expect } from '@playwright/test';
import { createAuthenticatedSession } from './helpers/testAuth';

const TEST_EMAIL = 'e2e-local-persistence@trippy-planner.test';

test.describe('Local route persistence across magic-link login (#44)', () => {
  test('route uploaded before login survives the magic-link reload and can then be saved', async ({ page }) => {
    await page.goto('/');

    // Upload a GPX file while anonymous
    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');

    // Clicking Save route while unauthenticated opens the sign-in panel, not an inline email form
    await page.getByRole('button', { name: 'Save route' }).click();
    await expect(page.getByPlaceholder(/your email/i)).toBeVisible();
    await page.getByPlaceholder(/your email/i).fill(TEST_EMAIL);
    await page.getByRole('button', { name: /send link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();

    // Simulate clicking the magic link: obtain the real token issued for this
    // email via the e2e test backdoor (backend e2e profile), the same way
    // my-routes.spec.ts establishes sessions.
    const token = await createAuthenticatedSession(TEST_EMAIL);

    // Clean up any routes left over from a previous run of this test.
    await page.evaluate(async (authToken) => {
      const res = await fetch('/api/routes', { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const routes: { id: string }[] = await res.json();
        for (const r of routes) {
          await fetch(`/api/routes/${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        }
      }
    }, token);

    // Navigate as the emailed magic link would — a full page load with ?token=
    await page.goto(`/?token=${token}`);
    await page.waitForTimeout(1000);

    // The route survives the full-page reload triggered by the magic link
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');

    // And the account is now authenticated
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();

    // Saving now succeeds — this is the behavior #44 reported as broken
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);
    await page.getByText('My routes').click();
    await page.waitForTimeout(500);
    const myRoutesPanel = page.locator('text=My routes').locator('..').locator('..');
    await expect(myRoutesPanel.locator('li')).toHaveCount(1);
    await expect(myRoutesPanel.locator('li').first()).toContainText('Sample Ride');
  });
});
