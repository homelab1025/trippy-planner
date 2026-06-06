import { test, expect } from '@playwright/test';

test('has title and upload button', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Trippy Planner/);
  await expect(page.getByText('Upload GPX')).toBeVisible();
});

test('shows empty state initially', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();
});

test('can upload GPX and see route details', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toBeVisible();
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  await expect(page.locator('.header-stats')).toContainText('km');
  await expect(page.locator('.header-stats')).toContainText('character-building');
});

test('has start date and start time inputs but no optimal start button', async ({ page }) => {
  await page.goto('/');

  // Verify date and time inputs exist by label
  await expect(page.getByLabel('Start Date')).toBeVisible();
  await expect(page.getByLabel('Start Time')).toBeVisible();

  // Verify the Optimal Start Time button is removed
  await expect(page.getByText('Find Optimal Start Time')).not.toBeVisible();
});

test('no pin markers on map after uploading GPX', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible();
  // Wait for weather API to respond so markers would appear in the pre-change implementation
  await page.waitForTimeout(3000);
  await expect(page.locator('.leaflet-marker-pane .leaflet-marker-icon')).toHaveCount(0);
});


test('Tech Details shows parse time and file size after GPX upload', async ({ page }) => {
  await page.goto('/');
  const techPanel = page.locator('.tech-details-card');
  await techPanel.locator('.collapse-title').click();

  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');

  await expect(techPanel.getByText('Parse time')).toBeVisible();
  await expect(techPanel.getByText('File')).toBeVisible();
  await expect(techPanel.locator('.stat-value').filter({ hasText: /\d+ ms/ })).toBeVisible();
  await expect(techPanel.locator('.stat-value').filter({ hasText: /\d+\.\d+ KB/ })).toBeVisible();
});

test('hover over elevation chart shows polished orange marker on map', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible();
  const elevationRow = page.locator('.elevation-row');
  await elevationRow.hover({ position: { x: 200, y: 50 } });
  await expect(page.locator('.leaflet-overlay-pane svg path[fill="#FF6B00"]')).toHaveCount(2);
});

test('uploading a non-GPX file shows alert and leaves app in empty state', async ({ page }) => {
  await page.goto('/');
  const dialogPromise = page.waitForEvent('dialog');
  await page.setInputFiles('input[type="file"]', 'tests/fixtures/invalid.txt');
  const dialog = await dialogPromise;
  await dialog.dismiss();
  // After dismissal, map/stats should still be absent
  await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();
});

test('uploading a 2-point GPX renders map and shows ~0 elevation gain', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'tests/fixtures/short-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Short Route');
  await expect(page.locator('.header-stats')).toContainText('0 m of character-building');
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible({ timeout: 10000 });
});

test('uploading a second file replaces the first route', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();

  // Upload a second file
  await page.setInputFiles('input[type="file"]', 'tests/fixtures/second-route.gpx');
  await expect(page.getByText('Second Route')).toBeVisible();
  await expect(page.getByText('Sample Ride')).not.toBeVisible();
});

test('clock/elapsed toggle changes button active state', async ({ page }) => {
  await page.goto('/');

  // Clock button is active by default (has btn-primary class)
  const clockBtn = page.getByRole('button', { name: 'Clock' });
  const elapsedBtn = page.getByRole('button', { name: 'Elapsed' });
  await expect(clockBtn).toHaveClass(/btn-primary/);
  await expect(elapsedBtn).not.toHaveClass(/btn-primary/);

  await elapsedBtn.click();
  await expect(elapsedBtn).toHaveClass(/btn-primary/);
  await expect(clockBtn).not.toHaveClass(/btn-primary/);

  await clockBtn.click();
  await expect(clockBtn).toHaveClass(/btn-primary/);
});

test('version is shown inside Tech Details panel', async ({ page }) => {
  await page.goto('/');
  const techPanel = page.locator('.tech-details-card');
  await techPanel.locator('.collapse-title').click();
  await expect(techPanel).toContainText(/v\d+\.\d+\.\d+/);
})

test('version remains in Tech Details after GPX upload', async ({ page }) => {
  await page.goto('/');
  const techPanel = page.locator('.tech-details-card');
  await techPanel.locator('.collapse-title').click();
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  await expect(techPanel).toContainText(/v\d+\.\d+\.\d+/);
})

test('uploading a route-only GPX shows a route-specific error message', async ({ page }) => {
  await page.goto('/');
  const dialogPromise = page.waitForEvent('dialog');
  await page.setInputFiles('input[type="file"]', 'samples/fells_loop.gpx');
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('This GPX file contains a route, not a recorded track.');
  await dialog.dismiss();
  // App stays in empty state
  await expect(page.getByText('Upload a GPX file to see your route')).toBeVisible();
});

test('changing speed rerenders elevation chart without crash', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  await expect(page.locator('.elevation-row')).toBeVisible();

  const speedInput = page.getByLabel('Average Speed (km/h)');
  // Ride Details is collapsed after upload — open it first
  await page.locator('.control-card .collapse-title').click();
  await speedInput.fill('10');
  await speedInput.dispatchEvent('change');

  await expect(page.locator('.elevation-row')).toBeVisible();
});

test('hovering over a chart shows values in hover pane', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');

  await expect(page.locator('.hover-pane')).toContainText(/hover over charts/i);

  // Hover the left portion of elevation-row (avoiding the hover-pane strip on the right)
  const elevationRow = page.locator('.elevation-row');
  await elevationRow.hover({ position: { x: 100, y: 50 } });

  await expect(page.locator('.hover-pane')).not.toContainText(/hover over charts/i);
});
