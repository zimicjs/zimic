import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 5000,
    hookTimeout: 5000,
    maxWorkers: process.env.CI === 'true' ? '50%' : '25%',
    minWorkers: 1,
    clearMocks: true,
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
