import { defineConfig, type UserConfig } from 'tsdown';

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
    INTERCEPTOR_SERVER_ACCESS_CONTROL_MAX_AGE: '',
    INTERCEPTOR_TOKEN_HASH_ITERATIONS: '1000000',
    VITEST_POOL_ID: '',
  },
} satisfies UserConfig;

const neutralConfig = (['cjs', 'esm'] as const).map<UserConfig>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs',
  entry: {
    index: 'src/index.ts',
    http: 'src/http/index.ts',
  },
  deps: {
    ...sharedConfig.deps,
    neverBundle: [...sharedConfig.deps.neverBundle, 'fs', 'util', 'buffer', 'crypto'],
  },
}));

const nodeConfig = (['cjs', 'esm'] as const).map<UserConfig>((format) => {
  const entry = {
    server: 'src/server/index.ts',
    cli: 'src/cli/index.ts',
    'scripts/postinstall': 'scripts/postinstall.ts',
  };

  return {
    ...sharedConfig,
    name: `node-${format}`,
    platform: 'node',
    format: [format],
    dts: format === 'cjs' ? { entry: [entry.server] } : false,
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
