/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: './public',
  test: {
    globals: false,
    testTimeout: 5000,
    minWorkers: 1,
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
    include: ['@vitest/coverage-istanbul'],
  },
  plugins: [],
});
