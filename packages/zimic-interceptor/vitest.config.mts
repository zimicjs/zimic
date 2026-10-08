import path from 'path';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  publicDir: './public',
  test: {
    watch: false,
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
          retry: process.env.CI === 'true' ? 2 : 0,
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
        '!({src/ws/**,src/server/InterceptorServer.ts,src/server/http/HttpInterceptorServerRuntime.ts})': {
          functions: 100,
          lines: 100,
          statements: 100,
          branches: 100,
        },
        // Temporarily reduced for Part 6 because the remaining tests are in Part 7 (#1339).
        // Restore the global 100% minimums and remove these overrides in Part 7.
        'src/ws/**': {
          functions: 94.37,
          lines: 96.9,
          statements: 96.88,
          branches: 92.16,
        },
        'src/server/InterceptorServer.ts': {
          functions: 93.84,
          lines: 90.54,
          statements: 90.23,
          branches: 80,
        },
        'src/server/http/HttpInterceptorServerRuntime.ts': {
          functions: 100,
          lines: 97.84,
          statements: 97.91,
          branches: 90.62,
        },
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
