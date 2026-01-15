import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  keepNames: false,
  external: [/.*vitest.*/],
};

const neutralConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs',
  entry: {
    types: 'src/types/index.ts',
    data: 'src/data/index.ts',
    error: 'src/error/index.ts',
    fetch: 'src/fetch/index.ts',
    import: 'src/import/index.ts',
    logging: 'src/logging/index.ts',
    time: 'src/time/index.ts',
    url: 'src/url/index.ts',
  },
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `node-${format}`,
  platform: 'node',
  format: [format],
  dts: format === 'cjs',
  entry: {
    process: 'src/process/index.ts',
    server: 'src/server/index.ts',
  },
}));

const configs: Options[] = [...neutralConfig, ...nodeConfig];

export default defineConfig(
  configs.map((config, index) => ({
    ...config,
    // Builds performed by tsup face concurrency problems when generating .d.ts files with multiple configs.
    // To workaround this, we only clean the dist folder on the last build.
    clean: index === configs.length - 1,
  })),
);
