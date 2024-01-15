import { defineConfig } from 'tsup';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProductionBuild = NODE_ENV === 'production';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    interceptor: 'src/interceptor/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: false,
  sourcemap: !isProductionBuild,
  treeshake: isProductionBuild,
  minify: isProductionBuild,
  clean: options.watch !== true,
}));
