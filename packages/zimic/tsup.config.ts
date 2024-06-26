import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  bundle: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
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
    interceptor: 'src/interceptor/index.ts',
  },
  external: ['util', 'buffer', 'crypto'],
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `node-${format}`,
  platform: 'node',
  format: [format],
  dts: format === 'cjs',
  entry: {
    server: 'src/interceptor/server/index.ts',
  },
}));

const cliConfig = (['cjs'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: 'cli',
  platform: 'node',
  format: [format],
  dts: false,
  entry: {
    cli: 'src/cli/index.ts',
    'scripts/postinstall': 'scripts/postinstall.ts',
  },
}));

export default defineConfig([...neutralConfig, ...nodeConfig, ...cliConfig]);
