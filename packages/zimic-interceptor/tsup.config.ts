import { Options, defineConfig } from 'tsup';

const sharedConfig = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  keepNames: false,
  noExternal: ['@zimic/utils'],
  external: [/.*vitest.*/],
  env: {
    INTERCEPTOR_SERVER_ACCESS_CONTROL_MAX_AGE: '',
    INTERCEPTOR_TOKEN_HASH_ITERATIONS: '1000000',
    VITEST_POOL_ID: '',
  },
} satisfies Options;

const neutralConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs' ? { resolve: true } : false,
  entry: {
    index: 'src/index.ts',
    http: 'src/http/index.ts',
  },
  external: [...sharedConfig.external, 'fs', 'util', 'buffer', 'crypto'],
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => {
  const entry = {
    server: 'src/server/index.ts',
    cli: 'src/cli/index.ts',
    'scripts/postinstall': 'scripts/postinstall.ts',
  };

  const dtsEntry = {
    server: entry.server,
  };

  return {
    ...sharedConfig,
    name: `node-${format}`,
    platform: 'node',
    format: [format],
    dts: format === 'cjs' ? { entry: dtsEntry, resolve: true } : false,
    entry,
  };
});

const configs: Options[] = [...neutralConfig, ...nodeConfig];

export default defineConfig(
  configs.map((config, index) => ({
    ...config,
    // Builds performed by tsup face concurrency problems when generating .d.ts files with multiple configs.
    // To workaround this, we only clean the dist folder on the last build.
    clean: index === configs.length - 1,
  })),
);
