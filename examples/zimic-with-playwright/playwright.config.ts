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
    baseURL: `http://localhost:${environment.PORT + environment.PLAYWRIGHT_WORKER_INDEX}`,
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

  webServer: Array.from({ length: environment.PLAYWRIGHT_WORKERS }, (_, workerIndex) => {
    const port = environment.PORT + workerIndex;

    return {
      command: `pnpm run dev --port ${port}`,
      port,
      reuseExistingServer: false,
      timeout: 1000 * 30,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        GITHUB_API_BASE_URL: `${environment.GITHUB_API_BASE_URL}/${workerIndex}`,
      },
    };
  }),
});
