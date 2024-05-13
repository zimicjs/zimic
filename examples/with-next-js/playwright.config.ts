import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI === 'true';

export default defineConfig({
  testDir: './src',
  testMatch: '**/__tests__/**/*.e2e.test.ts',
  forbidOnly: CI,
  retries: CI ? 1 : 2,
  workers: 1,
  fullyParallel: false,
  reporter: CI ? 'html' : undefined,
  timeout: 1000 * 60,

  expect: {
    timeout: 10000,
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
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        isMobile: true,
        defaultBrowserType: 'chromium',
      },
    },
  ],

  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: true,
    timeout: 1000 * 20,
  },
});
