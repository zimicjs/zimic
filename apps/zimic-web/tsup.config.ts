import path from 'path';
import { defineConfig } from 'tsup';

export default defineConfig({
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
  platform: 'node',
  format: ['cjs'],
  dts: false,
  entry: {
    index: path.join('src', 'api', 'index.ts'),
    serverless: path.join('src', 'api', 'serverless.ts'),
  },
});
