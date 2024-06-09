import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  format: ['cjs', 'esm'],
  dts: true,
  bundle: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: false,
  env: {
    SERVER_ACCESS_CONTROL_MAX_AGE: '',
  },
};

export default defineConfig([
  {
    ...sharedConfig,
    name: 'neutral',
    platform: 'neutral',
    entry: {
      index: 'src/index.ts',
      interceptor: 'src/interceptor/index.ts',
    },
    external: ['util', 'buffer', 'crypto'],
  },
  {
    ...sharedConfig,
    name: 'node',
    platform: 'node',
    entry: {
      server: 'src/interceptor/server/index.ts',
    },
  },
  {
    ...sharedConfig,
    name: 'cli',
    platform: 'node',
    format: ['cjs'],
    dts: false,
    entry: {
      cli: 'src/cli/index.ts',
      'scripts/postinstall': 'scripts/postinstall.ts',
    },
  },
]);
