/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./tests/*.test.ts'],
    globals: false,
    browser: {
      name: 'chromium',
      provider: 'playwright',
      enabled: true,
      headless: true,
    },
  },
});
