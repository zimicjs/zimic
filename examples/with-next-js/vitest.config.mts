/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['./{src,tests}/**/*.test.ts', './{src,tests}/**/*.test.tsx'],
    globals: false,
    setupFiles: ['./tests/setup.ts'],
  },
  plugins: [react()],
});
