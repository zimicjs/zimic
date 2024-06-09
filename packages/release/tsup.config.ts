import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  format: ['cjs', 'esm'],
  dts: true,
  bundle: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
};

export default defineConfig([
  {
    ...sharedConfig,
    name: 'node',
    platform: 'node',
    entry: {
      index: 'src/index.ts',
    },
  },
  {
    ...sharedConfig,
    name: 'cli',
    platform: 'node',
    format: ['cjs'],
    dts: false,
    entry: {
      cli: 'src/cli/entry.ts',
    },
  },
]);
