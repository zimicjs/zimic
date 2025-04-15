import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  testMatch: '**/__tests__/**/*.e2e.test.ts',
  fullyParallel: true,
  retries: 1,
  workers: process.env.PLAYWRIGHT_WORKERS,
  reporter: [['html', { outputFolder: './tests/reports' }]],
  outputDir: './tests/outputs',
  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  use: {
    baseURL: 'http://localhost:3006',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        isMobile: false,
        defaultBrowserType: 'chromium',
      },
    },
  ],

  webServer: {
    command: 'pnpm run dev:mock',
    port: 3006,
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});
