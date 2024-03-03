/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['./tests/*.test.ts'],
    globals: false,
    setupFiles: ['./tests/setup.ts'],
  },
});
