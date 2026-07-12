import { defineConfig, type UserConfig } from 'tsdown';

const isDevelopment = process.env.npm_lifecycle_event === 'dev';

const sharedConfig = {
  sourcemap: true,
  treeshake: true,
  minify: false,
  target: false,
  deps: {
    alwaysBundle: ['@zimic/utils'],
    neverBundle: [/.*vitest.*/],
  },
  env: {
    TYPEGEN_HTTP_IMPORT_MODULE: isDevelopment ? '@/index' : '@zimic/http',
  },
} satisfies UserConfig;

const neutralConfig = (['cjs', 'esm'] as const).map<UserConfig>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs' ? { resolver: 'tsc' } : false,
  entry: {
    index: 'src/index.ts',
  },
  deps: {
    ...sharedConfig.deps,
    neverBundle: [...sharedConfig.deps.neverBundle, /@zimic\/fetch/],
  },
}));

const nodeConfig = (['cjs', 'esm'] as const).map<UserConfig>((format) => {
  const entry = {
    typegen: 'src/typegen/index.ts',
    cli: 'src/cli/index.ts',
  };

  return {
    ...sharedConfig,
    name: `node-${format}`,
    platform: 'node',
    format: [format],
    dts: format === 'cjs' ? { entry: [entry.typegen], resolver: 'tsc' } : false,
    entry,
  };
});

const configs: UserConfig[] = [...neutralConfig, ...nodeConfig];

export default defineConfig(
  configs.map((config, index) => ({
    ...config,
    // Builds with multiple configs face concurrency problems when generating .d.ts files.
    // To work around this, only clean the dist folder on the last build.
    clean: index === configs.length - 1,
  })),
);
