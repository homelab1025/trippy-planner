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
