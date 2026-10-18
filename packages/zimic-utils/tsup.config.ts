import fs from 'fs';
import { Options, defineConfig } from 'tsup';

// tsup builds all configs concurrently, so the `clean` option of one config can remove files that other configs,
// including their .d.ts workers, have already written. Clean the dist folder once before any config starts instead.
fs.rmSync('dist', { recursive: true, force: true });

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  keepNames: false,
  external: [/.*vitest.*/],
};

const neutralConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs',
  entry: {
    types: 'src/types/index.ts',
    data: 'src/data/index.ts',
    error: 'src/error/index.ts',
    fetch: 'src/fetch/index.ts',
    http: 'src/http/index.ts',
    import: 'src/import/index.ts',
    logging: 'src/logging/index.ts',
    time: 'src/time/index.ts',
    url: 'src/url/index.ts',
    validation: 'src/validation/index.ts',
    ws: 'src/ws/index.ts',
  },
}));

const nodeConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `node-${format}`,
  platform: 'node',
  format: [format],
  dts: format === 'cjs',
  entry: {
    process: 'src/process/index.ts',
    server: 'src/server/index.ts',
  },
}));

export default defineConfig([...neutralConfig, ...nodeConfig]);
