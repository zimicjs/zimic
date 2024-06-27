/// <reference types="vitest" />

import path from 'path';
import { UserConfig, defineConfig } from 'vitest/config';

export const defaultConfig: UserConfig = {
  publicDir: './public',
  test: {
    globals: false,
    allowOnly: process.env.CI !== 'true',
    testTimeout: 5000,
    hookTimeout: 5000,
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
        '**/local/**',
        '**/public/**',
        'tests/setup/global/**',
        'scripts/dev/**',
        '**/types/**',
        '**/types.ts',
        '**/typescript.ts',
        '.eslintrc.js',
        '.lintstagedrc.js',
        'vitest.*.mts',
      ],
    },
  },
  define: {
    'process.env.SERVER_ACCESS_CONTROL_MAX_AGE': "'0'",
    'process.env.TYPEGEN_ROOT_IMPORT_MODULE': "'@/index'",
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@scripts': path.resolve(__dirname, './scripts'),
      '@@': path.resolve(__dirname, '.'),
    },
  },
  plugins: [],
};

export default defineConfig(defaultConfig);
