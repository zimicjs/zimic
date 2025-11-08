import path from 'path';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  publicDir: './public',
  test: {
    globals: false,
    testTimeout: 7500,
    hookTimeout: 7500,
    maxWorkers: process.env.CI === 'true' ? '50%' : '25%',
    clearMocks: true,
    projects: [
      {
        extends: true,
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
        extends: true,
        test: {
          name: 'browser',
          environment: undefined,
          include: ['./{src,tests,scripts}/**/*.test.ts', './{src,tests,scripts}/**/*.browser.test.ts'],
          exclude: ['**/*.node.test.ts'],
          globalSetup: './tests/setup/global/browser.ts',
          setupFiles: ['./tests/setup/browser.ts'],
          // We may need to retry browser tests on CI because browsers may retry failed requests, causing tests that
          // expect failures to be flaky.
          retry: process.env.CI === 'true' ? 5 : 0,
          browser: {
            instances: [{ browser: 'chromium' }],
            provider: playwright(),
            enabled: true,
            headless: true,
            screenshotFailures: false,
          },
        },
        define: {
          'process.env.GLOBAL_FALLBACK_SERVER_PORT': "'3003'",
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
  define: {
    'process.env.INTERCEPTOR_SERVER_ACCESS_CONTROL_MAX_AGE': "'0'",
    'process.env.INTERCEPTOR_TOKEN_HASH_ITERATIONS': "'10000'",
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@scripts': path.resolve(__dirname, './scripts'),
      '@@': path.resolve(__dirname, '.'),
    },
  },
  optimizeDeps: {
    include: ['@vitest/coverage-istanbul'],
  },
  plugins: [],
});
