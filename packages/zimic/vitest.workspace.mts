/// <reference types="vitest" />

import { defineWorkspace } from 'vitest/config';

const shouldIncludeExtendedBrowsers = process.env.CI === 'true' || process.env.ALL_BROWSERS === 'true';

const baseBrowserNames = ['chromium'] as const;
const extendedBrowserNames = [] as const;
const browserNames = [...baseBrowserNames, ...(shouldIncludeExtendedBrowsers ? extendedBrowserNames : [])];

export default defineWorkspace([
  {
    extends: 'vitest.config.mts',
    test: {
      name: 'node',
      environment: 'node',
      include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.node.test.ts'],
      exclude: ['**/*.browser.test.ts', '**/*.browserNoWorker.test.ts'],
    },
  },
  ...browserNames.flatMap((browserName) => [
    {
      extends: 'vitest.config.mts',
      test: {
        name: `browser-${browserName}`,
        environment: undefined,
        include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.browser.test.ts'],
        exclude: ['**/*.node.test.ts', '**/*.browserNoWorker.test.ts'],
        globalSetup: './tests/setup/global/browser.ts',
        browser: {
          name: browserName,
          provider: 'playwright',
          enabled: true,
          headless: true,
          screenshotFailures: false,
        },
      },
    },
    {
      extends: 'vitest.config.noPublic.mts',
      test: {
        name: `browser-${browserName}-no-worker`,
        environment: undefined,
        include: ['./{src,tests,scripts}/**/*.browserNoWorker.test.ts'],
        browser: {
          name: browserName,
          provider: 'playwright',
          enabled: true,
          headless: true,
          screenshotFailures: false,
        },
      },
    },
  ]),
]);
