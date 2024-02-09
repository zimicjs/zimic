/// <reference types="vitest" />

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'vitest.config.mts',
    test: {
      name: 'node',
      environment: 'node',
      include: ['./{src,tests}/**/*.test.ts', './{src,tests}/**/*.node.test.ts'],
      exclude: ['**/*.browser.test.ts'],
    },
  },
  {
    extends: 'vitest.config.mts',
    test: {
      name: 'browser',
      environment: undefined,
      include: ['./{src,tests}/**/*.test.ts', './{src,tests}/**/*.browser.test.ts'],
      exclude: ['**/*.node.test.ts'],
      browser: {
        name: 'chromium',
        provider: 'playwright',
        enabled: true,
        headless: true,
      },
    },
  },
]);
