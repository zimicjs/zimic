import fs from 'fs';
import { Options, defineConfig } from 'tsup';

// tsup builds all configs concurrently, so the `clean` option of one config can remove files that other configs,
// including their .d.ts workers, have already written. Clean the dist folder once before any config starts instead.
fs.rmSync('dist', { recursive: true, force: true });

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
    'experimental/ws': 'src/ws/index.ts',
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

export default defineConfig([...neutralConfig, ...nodeConfig]);
