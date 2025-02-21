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

const isDevelopment = process.env.npm_lifecycle_event === 'dev';

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
  keepNames: true,
  env: {
    TYPEGEN_HTTP_IMPORT_MODULE: isDevelopment ? '@/index' : '@zimic/http',
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
  },
  external: ['buffer'],
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => {
  const entry = {
    typegen: 'src/typegen/index.ts',
    cli: 'src/cli/index.ts',
  };

  const dtsEntry = pickKeys(entry, ['typegen']);

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
