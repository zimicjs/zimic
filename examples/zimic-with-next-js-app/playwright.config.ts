import { defineConfig, devices } from '@playwright/test';

import environment from './src/config/environment';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.test.ts',
  fullyParallel: true,
  retries: 1,
  workers: environment.PLAYWRIGHT_WORKERS,
  reporter: [['html', { outputFolder: './tests/reports' }]],
  outputDir: './tests/outputs',
  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  use: {
    baseURL: `http://localhost:${environment.PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: devices['Desktop Chrome'],
    },
  ],

  webServer: {
    command: `pnpm run dev --port ${environment.PORT}`,
    port: environment.PORT,
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});
