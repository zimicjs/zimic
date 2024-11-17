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
      exclude: ['**/*.browser.test.ts'],
      globalSetup: './tests/setup/global/node.ts',
    },
    define: {
      'process.env.GLOBAL_FALLBACK_SERVER_PORT': "'3002'",
    },
  },
  ...browserNames.flatMap((browserName) => [
    {
      extends: 'vitest.config.mts',
      test: {
        name: `browser-${browserName}`,
        environment: undefined,
        include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.browser.test.ts'],
        exclude: ['**/*.node.test.ts'],
        globalSetup: './tests/setup/global/browser.ts',
        browser: {
          name: browserName,
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
  ]),
]);
