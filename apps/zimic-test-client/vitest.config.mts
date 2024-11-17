/// <reference types="vitest" />

import os from 'os';
import path from 'path';
import { defineConfig } from 'vitest/config';

const numberOfCPUs = os.cpus().length;
const maxWorkers = process.env.CI === 'true' ? numberOfCPUs : Math.ceil(numberOfCPUs / 2);

export default defineConfig({
  publicDir: './public',
  test: {
    globals: false,
    testTimeout: 5000,
    minWorkers: 1,
    maxWorkers,
    maxConcurrency: maxWorkers,
    setupFiles: ['./tests/setup/shared.ts'],
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
