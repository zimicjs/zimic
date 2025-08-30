import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
  bundle: true,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  clean: true,
  keepNames: true,
};

const neutralConfig = (['cjs', 'esm'] as const).map<Options>((format) => ({
  ...sharedConfig,
  name: `neutral-${format}`,
  platform: 'neutral',
  format: [format],
  dts: format === 'cjs',
  entry: {
    types: 'src/types/index.ts',
    'types/json': 'src/types/json.ts',
    'data/isDefined': 'src/data/isDefined.ts',
    'data/isNonEmpty': 'src/data/isNonEmpty.ts',
    'data/blobEquals': 'src/data/blobEquals.ts',
    'data/fileEquals': 'src/data/fileEquals.ts',
    'data/jsonContains': 'src/data/jsonContains.ts',
    'data/jsonEquals': 'src/data/jsonEquals.ts',
    'error/expectToThrow': 'src/error/expectToThrow.ts',
    'fetch/expectFetchError': 'src/fetch/expectFetchError.ts',
    'import/createCachedDynamicImport': 'src/import/createCachedDynamicImport.ts',
    'logging/Logger': 'src/logging/Logger.ts',
    'time/waitFor': 'src/time/waitFor.ts',
    'time/waitForNot': 'src/time/waitForNot.ts',
    'time/waitForDelay': 'src/time/waitForDelay.ts',
    'url/createPathRegExp': 'src/url/createPathRegExp.ts',
    'url/excludeURLParams': 'src/url/excludeURLParams.ts',
    'url/joinURL': 'src/url/joinURL.ts',
    'url/validateURLPathParams': 'src/url/validateURLPathParams.ts',
    'url/validateURLProtocol': 'src/url/validateURLProtocol.ts',
  },
}));

export default defineConfig([...neutralConfig]);
