/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['./{src,tests}/**/*.test.ts'],
    exclude: ['**/.eslintrc.js', '**/.lintstagedrc.js', '**/types/**', '**/types.ts'],
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
        'dist/**',
        'tests/coverage/**',
        '**/types/**',
        '**/{*.d.ts,types}.ts',
        '**/{.eslintrc,.lintstagedrc}.js',
        '**/vitest.{config,workspace}.*',
        '**/tsup.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
  plugins: [],
});
