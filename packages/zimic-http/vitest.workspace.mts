import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'vitest.config.mts',
    test: {
      name: 'node',
      environment: 'node',
      include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.node.test.ts'],
      exclude: ['**/*.browser.test.ts'],
    },
  },

  {
    extends: 'vitest.config.mts',
    test: {
      name: 'browser',
      environment: undefined,
      include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.browser.test.ts'],
      exclude: ['**/*.node.test.ts'],
      browser: {
        instances: [{ browser: 'chromium' }],
        provider: 'playwright',
        enabled: true,
        headless: true,
        screenshotFailures: false,
      },
    },
  },
]);
