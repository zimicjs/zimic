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
  noExternal: ['@zimic/utils'],
  external: [/.*vitest.*/],
};

const neutralConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs' ? { resolve: true } : false,
  entry: {
    index: 'src/index.ts',
  },
}));

export default defineConfig(neutralConfig);
