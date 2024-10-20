import path from 'path';
import { ViteUserConfig, defineConfig } from 'vitest/config';

export const defaultConfig: ViteUserConfig = {
  publicDir: './public',
  test: {
    globals: false,
    testTimeout: 5000,
    hookTimeout: 5000,
    retry: process.env.CI === 'true' ? 1 : 0,
    setupFiles: ['./tests/setup/shared.ts'],
    maxWorkers: process.env.CI === 'true' ? '100%' : '50%',
    minWorkers: 1,
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
        'scripts/dev/**',
        '**/types/**',
        '**/{*.d.ts,types,typescript}.ts',
        '**/{.eslintrc,.lintstagedrc}.js',
        '**/vitest.{config,workspace}.*',
        '**/tsup.config.*',
      ],
    },
  },
  define: {
    'process.env.SERVER_ACCESS_CONTROL_MAX_AGE': "'0'",
    'process.env.TYPEGEN_HTTP_IMPORT_MODULE': "'@/http'",
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@scripts': path.resolve(__dirname, './scripts'),
      '@@': path.resolve(__dirname, '.'),
    },
  },
  optimizeDeps: {
    include: ['@vitest/coverage-istanbul'],
  },
  plugins: [],
};

export default defineConfig(defaultConfig);
