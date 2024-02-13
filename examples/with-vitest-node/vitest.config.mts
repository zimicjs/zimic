/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./**/*.test.ts'],
    globals: false,
    allowOnly: process.env.CI !== 'true',
    setupFiles: ['./tests/setup.ts'],
  },
  plugins: [],
});
