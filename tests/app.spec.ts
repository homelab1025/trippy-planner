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

test('subtle weather dots visible on map after uploading GPX', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  // Leaflet renders CircleMarker as SVG <path> elements (arc commands), not <circle>
  await expect(page.locator('.leaflet-overlay-pane svg path[fill="#888"]')).not.toHaveCount(0, { timeout: 10000 });
});

test('Tech Details shows parse time and file size after GPX upload', async ({ page }) => {
  await page.goto('/');

  const techPanel = page.locator('.stats-card').filter({ hasText: 'Tech Details' });
  await expect(techPanel.getByText('Parse time')).toBeVisible();
  await expect(techPanel.getByText('File')).toBeVisible();

  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();

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
