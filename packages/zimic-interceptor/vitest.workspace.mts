import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'vitest.config.mts',
    test: {
      name: 'node',
      environment: 'node',
      include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.node.test.ts'],
      exclude: ['**/*.browser.test.ts'],
      globalSetup: './tests/setup/global/node.ts',
    },
    define: {
      'process.env.GLOBAL_FALLBACK_SERVER_PORT': "'3002'",
    },
  },

  {
    extends: 'vitest.config.mts',
    test: {
      name: 'browser',
      retry: process.env.CI === 'true' ? 1 : 0,
      environment: undefined,
      include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.browser.test.ts'],
      exclude: ['**/*.node.test.ts'],
      globalSetup: './tests/setup/global/browser.ts',
      browser: {
        instances: [{ browser: 'chromium' }],
        provider: 'playwright',
        enabled: true,
        headless: true,
        screenshotFailures: false,
      },
    },
    define: {
      'process.env.GLOBAL_FALLBACK_SERVER_PORT': "'3003'",
    },
  },
]);
