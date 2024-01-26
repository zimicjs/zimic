import { Options, defineConfig } from 'tsup';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProductionBuild = NODE_ENV === 'production';

function getSharedConfig(): Options {
  return {
    format: ['cjs', 'esm'],
    dts: true,
    bundle: true,
    splitting: false,
    sourcemap: true,
    treeshake: isProductionBuild,
    minify: isProductionBuild,
    clean: true,
  };
}

export default defineConfig(() => {
  const sharedConfig = getSharedConfig();

  return [
    {
      ...sharedConfig,
      entry: {
        index: 'src/index.ts',
        interceptor: 'src/interceptor/index.ts',
        'interceptor/node': 'src/interceptor/node.ts',
        'interceptor/browser': 'src/interceptor/browser.ts',
      },
    },
  ] as const;
});
