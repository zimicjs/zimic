import { Options, defineConfig } from 'tsup';

const isDevelopment = process.env.npm_lifecycle_event === 'dev';

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
    TYPEGEN_HTTP_IMPORT_MODULE: isDevelopment ? '@/index' : '@zimic/http',
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
  },
  external: [...sharedConfig.external, /@zimic\/fetch/],
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => {
  const entry = {
    typegen: 'src/typegen/index.ts',
    cli: 'src/cli/index.ts',
  };

  const dtsEntry = {
    typegen: entry.typegen,
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
