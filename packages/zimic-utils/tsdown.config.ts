import { defineConfig, type UserConfig } from 'tsdown';

const sharedConfig: UserConfig = {
  sourcemap: true,
  treeshake: true,
  minify: false,
  target: false,
  deps: {
    neverBundle: [/.*vitest.*/],
  },
};

const neutralConfig = (['cjs', 'esm'] as const).map<UserConfig>((format) => ({
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

const nodeConfig = (['cjs', 'esm'] as const).map<UserConfig>((format) => ({
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

const configs: UserConfig[] = [...neutralConfig, ...nodeConfig];

export default defineConfig(
  configs.map((config, index) => ({
    ...config,
    // Builds with multiple configs face concurrency problems when generating .d.ts files.
    // To work around this, only clean the dist folder on the last build.
    clean: index === configs.length - 1,
  })),
);
