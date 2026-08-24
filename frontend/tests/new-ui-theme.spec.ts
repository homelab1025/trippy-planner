import { test, expect } from '@playwright/test';

test('default theme has no ui param: emerald theme, constrained width', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
  await expect(page.locator('.max-w-\\[1400px\\]')).toBeVisible();
});

test('?ui=new switches to the alpine theme, full width', async ({ page }) => {
  await page.goto('/?ui=new');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'alpine');
  await expect(page.locator('.max-w-\\[1400px\\]')).toHaveCount(0);
  // Sanity check the app is still fully functional under the new theme.
  await expect(page.getByText('Upload GPX')).toBeVisible();
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
});
