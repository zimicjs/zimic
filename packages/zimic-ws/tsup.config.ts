import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
  keepNames: false,
};

const neutralConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs' ? { resolve: true } : false,
  entry: {
    index: 'src/index.ts',
  },
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `node-${format}`,
  platform: 'node',
  format: [format],
  dts: format === 'cjs' ? { resolve: true } : false,
  entry: {
    server: 'src/server/index.ts',
  },
}));

export default defineConfig([...neutralConfig, ...nodeConfig]);
