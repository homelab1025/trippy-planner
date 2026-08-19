import { defineConfig, devices } from '@playwright/test';

const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT ?? '5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${frontendPort} --strictPort`,
    url: `http://localhost:${frontendPort}`,
    reuseExistingServer: !process.env.CI,
  },
});
