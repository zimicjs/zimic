import path from 'path';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  publicDir: './public',
  test: {
    watch: false,
    globals: false,
    testTimeout: 5000,
    hookTimeout: 5000,
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
      // TODO: Testing in a browser environment is temporarily disabled while we implement WebSocket interceptors in
      // @zimic/interceptor. For now, we only run tests in a Node environment, which can spin up and manipulate
      // WebSocket servers for testing.
      // {
      //   extends: true,
      //   test: {
      //     name: 'browser',
      //     environment: undefined,
      //     include: ['./{src,tests}/**/*.test.ts', './{src,tests}/**/*.browser.test.ts'],
      //     exclude: ['**/*.node.test.ts'],
      //     browser: {
      //       instances: [{ browser: 'chromium' }],
      //       provider: playwright(),
      //       enabled: true,
      //       headless: true,
      //       screenshotFailures: false,
      //     },
      //   },
      // },
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
  optimizeDeps: {
    include: ['@vitest/coverage-istanbul'],
  },
  plugins: [],
});
