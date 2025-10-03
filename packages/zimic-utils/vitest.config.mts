import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: './public',
  test: {
    globals: false,
    testTimeout: 5000,
    hookTimeout: 5000,
    maxWorkers: process.env.CI === 'true' ? '50%' : '25%',
    minWorkers: 1,
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
            provider: 'playwright',
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
      include: [
        '{src,tests}/**/*.test.ts',
        'src/data/jsonEquals.ts',
        'src/data/jsonContains.ts',
        'src/url/createRegexFromPath.ts',
        'src/url/createWildcardRegexFromPath.ts',
      ],
      exclude: [
        '**/node_modules/**',
        'local/**',
        'public/**',
        'dist/**',
        'tests/coverage/**',
        'tests/setup/global/**',
        '**/types/**',
        '**/{*.d.ts,types,typescript}.ts',
        '**/.lintstagedrc.js',
        '**/eslint.config.mjs',
        '**/vitest.{config,workspace}.*',
        '**/tsup.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@@': path.resolve(__dirname, '.'),
    },
  },
  plugins: [],
});
