import { Options, defineConfig } from 'tsup';

function pickKeys<Type, Key extends keyof Type>(object: Type, keys: Key[]): Pick<Type, Key> {
  return keys.reduce(
    (pickedObject, key) => {
      pickedObject[key] = object[key];
      return pickedObject;
    },
    {} as Pick<Type, Key>,
  );
}

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
  keepNames: true,
  env: {
    SERVER_ACCESS_CONTROL_MAX_AGE: '',
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
    'interceptor/http': 'src/interceptor/http/index.ts',
  },
  external: ['util', 'buffer', 'crypto'],
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => {
  const entry = {
    'interceptor/server': 'src/interceptor/server/index.ts',
    cli: 'src/cli/index.ts',
    'scripts/postinstall': 'scripts/postinstall.ts',
  };

  const dtsEntry = pickKeys(entry, ['interceptor/server']);

  return {
    ...sharedConfig,
    name: `node-${format}`,
    platform: 'node',
    format: [format],
    dts: format === 'cjs' ? { entry: dtsEntry } : false,
    entry,
  };
});

export default defineConfig([...neutralConfig, ...nodeConfig]);
