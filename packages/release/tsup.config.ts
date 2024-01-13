import { defineConfig } from 'tsup';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/entry.ts',
  },
  env: {
    NODE_ENV,
  },
  format: ['cjs'],
  dts: false,
  sourcemap: !isProduction,
  treeshake: isProduction,
  minify: isProduction,
  clean: options.watch !== true,
}));
