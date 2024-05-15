import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI === 'true';

export default defineConfig({
  testDir: './src',
  testMatch: '**/__tests__/**/*.e2e.test.ts',
  forbidOnly: CI,
  fullyParallel: true,
  retries: CI ? 1 : 0,
  reporter: CI ? 'html' : undefined,
  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'en-US',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
    url: 'http://localhost:3000',
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: true,
    timeout: 1000 * 20,
  },
});
