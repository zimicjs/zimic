import fs from 'fs';
import { Options, defineConfig } from 'tsup';

// tsup builds all configs concurrently, so the `clean` option of one config can remove files that other configs,
// including their .d.ts workers, have already written. Clean the dist folder once before any config starts instead.
fs.rmSync('dist', { recursive: true, force: true });

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

export default defineConfig([...neutralConfig, ...nodeConfig]);
