import { defineConfig, type UserConfig } from 'tsdown';

const sharedConfig: UserConfig = {
  sourcemap: true,
  treeshake: true,
  minify: false,
  target: false,
  deps: {
    alwaysBundle: ['@zimic/utils'],
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
    index: 'src/index.ts',
  },
}));

const configs: UserConfig[] = [...neutralConfig];

export default defineConfig(
  configs.map((config, index) => ({
    ...config,
    // Builds with multiple configs face concurrency problems when generating .d.ts files.
    // To work around this, only clean the dist folder on the last build.
    clean: index === configs.length - 1,
  })),
);
