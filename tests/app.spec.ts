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
  
  // Set files on the hidden input element
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  
  // Verify that the route stats and details appear
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.getByText('Distance')).toBeVisible();
  await expect(page.getByText('Elevation Gain')).toBeVisible();
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

  const techPanel = page.locator('.stats-card').filter({ hasText: 'Tech Details' });
  await techPanel.locator('h3').click();

  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();

  await expect(techPanel.getByText('Parse time')).toBeVisible();
  await expect(techPanel.getByText('File')).toBeVisible();
  await expect(techPanel.locator('.stat-value').filter({ hasText: /\d+ ms/ })).toBeVisible();
  await expect(techPanel.locator('.stat-value').filter({ hasText: /\d+\.\d+ KB/ })).toBeVisible();
});

test('hover over timeline shows polished orange marker on map', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible();
  const timeline = page.locator('.timeline-container');
  await timeline.hover({ position: { x: 200, y: 100 } });
  // Two stacked CircleMarkers: glow ring + core dot, both fill="#FF6B00"
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
  await expect(page.getByText('Short Route')).toBeVisible();
  await expect(page.getByText('Elevation Gain')).toBeVisible();
  // Elevation gain should be 0 m (flat route)
  const gainValue = page.locator('.stat-item').filter({ hasText: 'Elevation Gain' }).locator('.stat-value');
  await expect(gainValue).toHaveText('0 m');
  // Map should render without crash
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

test('version panel is always visible on page load', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('.build-info-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(/v\d+\.\d+\.\d+/)
})

test('version panel remains visible after GPX upload', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx')
  await expect(page.getByText('Sample Ride')).toBeVisible()
  await expect(page.locator('.build-info-panel')).toBeVisible()
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

test('changing speed rerenders timeline without crash', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.timeline-container')).toBeVisible();

  const speedInput = page.getByLabel('Average Speed (km/h)');
  await speedInput.fill('10');
  await speedInput.dispatchEvent('change');

  // Timeline should still be rendered after speed update
  await expect(page.locator('.timeline-container')).toBeVisible();
});
