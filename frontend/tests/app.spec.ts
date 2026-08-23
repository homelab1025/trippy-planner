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


test('parse time and file size are logged to the console, not shown in Tech Details', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', msg => consoleMessages.push(msg.text()));

  await page.goto('/');
  const techPanel = page.locator('.tech-details-card');
  await techPanel.locator('.collapse-title').click();

  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');

  await expect(techPanel.getByText('Parse time')).toHaveCount(0);
  await expect(techPanel.getByText('File', { exact: true })).toHaveCount(0);
  await expect
    .poll(() => consoleMessages.some(m => /\[gpx\] parsed in \d+ms \(file: [\d.]+KB\)/.test(m)))
    .toBe(true);
});

test('editing DP Epsilon after upload re-parses the route and re-fetches weather on blur', async ({ page }) => {
  const weatherRequestUrls: string[] = [];
  page.on('request', req => {
    if (req.url().includes('api.open-meteo.com')) weatherRequestUrls.push(req.url());
  });

  await page.goto('/');
  const techPanel = page.locator('.tech-details-card');
  await techPanel.locator('.collapse-title').click();

  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  await expect.poll(() => weatherRequestUrls.length).toBeGreaterThan(0);
  const requestsAfterUpload = weatherRequestUrls.length;

  const epsilonInput = techPanel.getByLabel('DP Epsilon (m)');
  await expect(epsilonInput).toBeEnabled();
  await epsilonInput.fill('1000');
  await epsilonInput.blur();

  // Re-parsing produces new route point objects; weatherPoints are matched to
  // route.points by reference, so a re-fetch is required to keep weather markers
  // attached (otherwise they'd silently vanish from the chart).
  await expect.poll(() => weatherRequestUrls.length).toBeGreaterThan(requestsAfterUpload);
});

test('DP Epsilon and Max Gap survive a page reload', async ({ page }) => {
  await page.goto('/');
  const techPanel = page.locator('.tech-details-card');
  await techPanel.locator('.collapse-title').click();

  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');

  const epsilonInput = techPanel.getByLabel('DP Epsilon (m)');
  const maxGapInput = techPanel.getByLabel('Max Gap (m)');
  await epsilonInput.fill('42');
  await epsilonInput.blur();
  await maxGapInput.fill('123');
  await maxGapInput.blur();

  await page.reload();
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');
  await techPanel.locator('.collapse-title').click();
  await expect(techPanel.getByLabel('DP Epsilon (m)')).toHaveValue('42');
  await expect(techPanel.getByLabel('Max Gap (m)')).toHaveValue('123');
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

// TODO: this test only checks the toggle's checked state, not whether the displayed time
// actually changes format. See 'clock/elapsed toggle changes time format shown in hover pane'
// for the meaningful coverage.
test('clock/elapsed toggle switches mode', async ({ page }) => {
  await page.goto('/');

  const toggle = page.locator('#xaxis-toggle');

  // Clock mode by default — toggle unchecked
  await expect(toggle).not.toBeChecked();

  // Switch to Elapsed
  await toggle.click();
  await expect(toggle).toBeChecked();

  // Switch back to Clock
  await toggle.click();
  await expect(toggle).not.toBeChecked();
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
  await page.setInputFiles('input[type="file"]', '../samples/fells_loop.gpx');
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

test('clock/elapsed toggle changes time format shown in hover pane', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.locator('.header-stats')).toContainText('Sample Ride');

  const elevationRow = page.locator('.elevation-row');
  await elevationRow.hover({ position: { x: 100, y: 50 } });
  await expect(page.locator('.hover-pane')).not.toContainText(/hover over charts/i);

  // Clock mode: time is HH:MM (contains a colon)
  await expect(page.locator('.hover-pane')).toContainText(/\d{1,2}:\d{2}/);

  // Switch to elapsed
  await page.locator('#xaxis-toggle').click();
  await elevationRow.hover({ position: { x: 100, y: 50 } });

  // Elapsed mode: time is Xh YYm or Ym (no colon)
  await expect(page.locator('.hover-pane')).toContainText(/\d+h \d+m|\d+m/);
  await expect(page.locator('.hover-pane')).not.toContainText(/\d{1,2}:\d{2}/);
});
