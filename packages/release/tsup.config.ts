import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  dts: true,
  bundle: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
};

const cliConfig = (['cjs'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: 'cli',
  platform: 'node',
  format: [format],
  dts: false,
  entry: {
    cli: 'src/cli/entry.ts',
  },
}));

export default defineConfig([...cliConfig]);
