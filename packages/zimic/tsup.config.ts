import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
  env: {
    SERVER_ACCESS_CONTROL_MAX_AGE: '',
    TYPEGEN_ROOT_IMPORT_MODULE: 'zimic',
  },
};

const neutralConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs',
  entry: {
    index: 'src/index.ts',
    interceptor: 'src/interceptor/index.ts',
  },
  external: ['util', 'buffer', 'crypto'],
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => {
  const entry = {
    server: 'src/interceptor/server/index.ts',
    typegen: 'src/typegen/index.ts',
    cli: 'src/cli/index.ts',
    'scripts/postinstall': 'scripts/postinstall.ts',
  };

  const entriesToGenerateTypes: (keyof typeof entry)[] = ['server', 'typegen'];

  const dtsEntry = entriesToGenerateTypes.reduce<Record<string, string>>((dtsEntry, key) => {
    dtsEntry[key] = entry[key];
    return dtsEntry;
  }, {});

  return {
    ...sharedConfig,
    name: `node-${format}`,
    platform: 'node',
    format: [format],
    dts: format === 'cjs' ? { entry: dtsEntry } : false,
    entry,
    external: ['./index.mjs'],
  };
});

export default defineConfig([...neutralConfig, ...nodeConfig]);
