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
        '!({src/ws/**,src/server/InterceptorServer.ts,src/server/errors/StaleHttpRuntimeLoadError.ts,src/server/ws/WebSocketInterceptorServerRuntime.ts})':
          {
            functions: 100,
            lines: 100,
            statements: 100,
            branches: 100,
          },
        // Temporarily reduced for Part 6 because the remaining tests are in Part 7 (#1339).
        // Restore the global 100% minimums and remove these overrides in Part 7.
        'src/ws/**': {
          functions: 96.7,
          lines: 97.95,
          statements: 97.93,
          branches: 94.1,
        },
        // Part 7 covers the missing HTTP peer, HTTP runtime load race, and access control header paths.
        '{src/server/InterceptorServer.ts,src/server/errors/StaleHttpRuntimeLoadError.ts}': {
          functions: 94.59,
          lines: 89.93,
          statements: 89.93,
          branches: 78.31,
        },
        // Part 7 covers the WebSocket handler reset and user connection race paths.
        'src/server/ws/WebSocketInterceptorServerRuntime.ts': {
          functions: 96.66,
          lines: 94.73,
          statements: 94.77,
          branches: 88.09,
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
