/// <reference types="vitest" />

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: 'public',
  test: {
    watch: false,
    globals: true,
    include: ['./tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    clearMocks: true,
    browser: {
      instances: [{ browser: 'chromium' }],
      provider: playwright(),
      enabled: true,
      headless: true,
      screenshotFailures: false,
    },
  },
});
