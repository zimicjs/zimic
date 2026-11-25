/// <reference types="vitest" />
import { playwright } from '@vitest/browser-playwright';

import path from 'path';
import { defineConfig } from 'vitest/config';

import packageJSON from './package.json';

// Configuration packages are not runtime dependencies, and `@zimic/utils` is bundled into the published packages
// instead of installed by consumers.
const zimicRuntimePackageNames = Object.keys(packageJSON.devDependencies).filter(
  (packageName) =>
    packageName.startsWith('@zimic/') && !packageName.includes('config') && packageName !== '@zimic/utils',
);

export default defineConfig({
  publicDir: './public',
  test: {
    watch: false,
    globals: false,
    testTimeout: 5000,
    maxWorkers: process.env.CI === 'true' ? '50%' : '25%',
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['./{src,tests}/**/*.test.ts', './{src,tests}/**/*.node.test.ts'],
          exclude: ['**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          environment: undefined,
          include: ['./{src,tests}/**/*.test.ts', './{src,tests}/**/*.browser.test.ts'],
          exclude: ['**/*.node.test.ts'],
          browser: {
            instances: [{ browser: 'chromium' }],
            provider: playwright(),
            enabled: true,
            headless: true,
            screenshotFailures: false,
          },
        },
      },
    ],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      reportsDirectory: './tests/coverage',
      thresholds: {
        functions: 100,
        lines: 100,
        statements: 100,
        branches: 100,
      },
      exclude: [
        '**/node_modules/**',
        'local/**',
        'public/**',
        'tests/coverage/**',
        '**/types/**',
        '**/{*.d.ts,types}.ts',
        '**/.lintstagedrc.js',
        '**/eslint.config.mjs',
        '**/vitest.{config,workspace}.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
  optimizeDeps: {
    // The prebundle cache key ignores rebuilds of linked workspace packages, so a reused cache would run stale code.
    force: true,
    // Vite does not pre-bundle linked workspace packages by default, unlike packages installed from the registry.
    // Including every entry point of the Zimic packages makes browser tests load them as consumers do.
    include: ['@vitest/coverage-istanbul', ...zimicRuntimePackageNames.map((packageName) => `${packageName}/**`)],
  },
  plugins: [],
});
