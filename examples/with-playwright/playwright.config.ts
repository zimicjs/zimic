import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  testMatch: '**/__tests__/**/*.e2e.test.ts',
  fullyParallel: true,
  retries: 1,
  reporter: [['html', { outputFolder: './tests/reports' }]],
  outputDir: './tests/outputs',
  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
    command: 'pnpm run dev:test',
    url: 'http://localhost:3002',
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});
