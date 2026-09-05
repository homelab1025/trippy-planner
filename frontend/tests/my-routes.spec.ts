import { test, expect, Page } from '@playwright/test';
import { createAuthenticatedSession } from './helpers/testAuth';

// Helper: clean all routes via API before a test
async function cleanRoutes(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    const token = localStorage.getItem('trippy_session_token');
    if (!token) return;
    const res = await fetch('/api/routes', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const routes: { id: string }[] = await res.json();
      for (const r of routes) {
        await fetch(`/api/routes/${r.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  });
}

test.describe('My Routes panel', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    // Create a fresh session via the real magic-link flow (backend runs the
    // e2e profile, whose InMemoryEmailService captures the token instead of
    // emailing it) and pre-set it so the app thinks the user is logged in
    const token = await createAuthenticatedSession();
    await page.context().addInitScript((sessionToken) => {
      localStorage.setItem('trippy_session_token', sessionToken);
    }, token);
  });

  test('saved route appears in My Routes panel after save', async ({ page }) => {
    await cleanRoutes(page);

    // Upload a GPX file
    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);

    // Verify route loaded
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');

    // Click Save route (should save since authenticated via init script)
    await expect(page.getByRole('button', { name: 'Save route' })).toBeVisible();
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    // Open the collapsed My Routes panel
    await page.getByText('My routes').click();
    await page.waitForTimeout(500);

    // Verify route appears in My Routes panel (scoped to the panel)
    const myRoutesPanel = page.locator('text=My routes').locator('..').locator('..');
    await expect(myRoutesPanel).toBeVisible();
    const items = await myRoutesPanel.locator('li').all();
    expect(items).toHaveLength(1);
    expect(await items[0].textContent()).toContain('Sample Ride');
  });

  test('multiple routes appear in My Routes panel after saves', async ({ page }) => {
    await cleanRoutes(page);

    // Save first route
    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    // Open the collapsed My Routes panel
    await page.getByText('My routes').click();
    await page.waitForTimeout(500);

    // Verify first route in list
    const myRoutesPanel = page.locator('text=My routes').locator('..').locator('..');
    let items = await myRoutesPanel.locator('li').all();
    expect(items).toHaveLength(1);
    expect(await items[0].textContent()).toContain('Sample Ride');

    // Save second route (different file)
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/short-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Short Route');
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    // Verify both routes in list
    items = await myRoutesPanel.locator('li').all();
    expect(items).toHaveLength(2);
    const texts = await Promise.all(items.map(i => i.textContent()));
    expect(texts.some(t => t?.includes('Sample Ride'))).toBe(true);
    expect(texts.some(t => t?.includes('Short Route'))).toBe(true);
  });

  test('clicking a saved route loads it onto the map and chart', async ({ page }) => {
    await cleanRoutes(page);

    // Save a route
    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    // Clear the locally-persisted route, then reload — nothing should be loaded now.
    // (Without this, the reload would restore the just-saved route from
    // localStorage instead of leaving a blank slate — see #44.)
    await page.evaluate(() => localStorage.removeItem('trippy_current_route'));
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toHaveCount(0);
    await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();

    // Open My Routes and click the saved route (not its "Duplicate" action button,
    // whose accessible name also contains the route name — .first() picks the load button)
    await page.getByText('My routes').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Sample Ride/ }).first().click();
    await page.waitForTimeout(1000);

    // The route must actually load onto the map/chart, not just stay a list entry
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await expect(page.getByText('Upload a GPX file to see your route')).not.toBeVisible();
  });

  test('My Routes panel shows "No saved routes yet" when user is logged in with no routes', async ({ page }) => {
    await cleanRoutes(page);

    // Reload the page to get a clean MyRoutesPanel mount
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify My Routes panel is visible
    await expect(page.getByText('My routes')).toBeVisible();

    // Open the collapsed My Routes panel
    await page.getByText('My routes').click();
    await page.waitForTimeout(500);

    // Verify empty state text is present in the panel (collapse-content may have CSS transitions)
    const myRoutesPanel = page.locator('text=My routes').locator('..').locator('..');
    await expect(myRoutesPanel.locator('p').first()).toHaveText('No saved routes yet.');
  });

  test('My Routes panel is not visible when user is not logged in', async ({ page }) => {
    // Use a fresh context without the init script token
    const context = await page.context().browser()?.newContext();
    const freshPage = await context?.newPage();
    if (!freshPage) return;

    await freshPage.goto('/');
    await expect(freshPage.getByText('My routes')).not.toBeVisible();

    await context?.close();
  });

  test('deleting the currently loaded route clears the main view', async ({ page }) => {
    await cleanRoutes(page);

    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    await page.getByText('My routes').click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /Delete Sample Ride/i }).click();
    await expect(page.getByText(/Delete 'Sample Ride' on the/)).toBeVisible();
    await page.getByRole('button', { name: /^OK$/ }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.header-stats')).toHaveCount(0);
    await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();
    await expect(page.getByText('No saved routes yet.')).toBeVisible();
  });

  test('cancelling the delete dialog keeps the route', async ({ page }) => {
    await cleanRoutes(page);

    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    await page.getByText('My routes').click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /Delete Sample Ride/i }).click();
    await expect(page.getByText(/Delete 'Sample Ride' on the/)).toBeVisible();
    await page.getByRole('button', { name: /Cancel/i }).click();

    const myRoutesPanel = page.locator('text=My routes').locator('..').locator('..');
    const items = await myRoutesPanel.locator('li').all();
    expect(items).toHaveLength(1);
    expect(await items[0].textContent()).toContain('Sample Ride');
    // The still-loaded route in the main view is untouched.
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  });

  test('a saved route\'s checkpoints are restored when reloaded from My Routes', async ({ page }) => {
    await cleanRoutes(page);

    // Upload a GPX file
    await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');

    // Add a checkpoint by clicking the empty track, confirming the add, and
    // accepting the pre-filled interpolated arrival time.
    const track = page.getByTestId('checkpoint-track-line');
    const box = await track.boundingBox();
    if (!box) throw new Error('checkpoint track not found');
    await track.click({ position: { x: box.width * 0.4, y: box.height / 2 } });
    await page.getByRole('button', { name: /yes, add/i }).click();
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.locator('[data-checkpoint-marker][data-draggable="true"]')).toHaveCount(1);

    // Save the route (should save since authenticated via init script)
    await page.getByRole('button', { name: 'Save route' }).click();
    await page.waitForTimeout(500);

    // Clear the locally-persisted route, then reload — nothing should be loaded now
    // (same rationale as the "clicking a saved route loads it" test above: without
    // this, the reload would restore the just-saved route from localStorage instead
    // of exercising the My Routes load path).
    await page.evaluate(() => localStorage.removeItem('trippy_current_route'));
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(page.locator('.header-stats')).toHaveCount(0);

    // Open My Routes and load the saved route
    await page.getByText('My routes').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Sample Ride/ }).first().click();
    await page.waitForTimeout(1000);

    // The route — and the checkpoint it was saved with — are both restored
    await expect(page.locator('.header-stats')).toContainText('Sample Ride');
    await expect(page.locator('[data-checkpoint-marker][data-draggable="true"]')).toHaveCount(1);
  });
});
