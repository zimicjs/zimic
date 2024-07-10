import { Options, defineConfig } from 'tsup';

export function pickKeys<Type, Key extends keyof Type>(object: Type, keys: Key[]): Pick<Type, Key> {
  return keys.reduce(
    (pickedObject, key) => {
      pickedObject[key] = object[key];
      return pickedObject;
    },
    {} as Pick<Type, Key>, // eslint-disable-line @typescript-eslint/prefer-reduce-type-parameter
  );
}

const isDevelopment = process.env.npm_lifecycle_event === 'dev';

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
  env: {
    SERVER_ACCESS_CONTROL_MAX_AGE: '',
    TYPEGEN_HTTP_IMPORT_MODULE: isDevelopment ? '@/http' : 'zimic/http',
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
    http: 'src/http/index.ts',
    'interceptor/http': 'src/interceptor/http/index.ts',
  },
  external: ['util', 'buffer', 'crypto'],
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => {
  const entry = {
    'interceptor/server': 'src/interceptor/server/index.ts',
    typegen: 'src/typegen/index.ts',
    cli: 'src/cli/index.ts',
    'scripts/postinstall': 'scripts/postinstall.ts',
  };

  const dtsEntry = pickKeys(entry, ['interceptor/server', 'typegen']);

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
