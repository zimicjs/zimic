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
    'data/isDefined': 'src/data/isDefined.ts',
    'data/isNonEmpty': 'src/data/isNonEmpty.ts',
    'data/blobEquals': 'src/data/blobEquals.ts',
    'data/blobContains': 'src/data/blobContains.ts',
    'data/fileEquals': 'src/data/fileEquals.ts',
    'error/expectToThrow': 'src/error/expectToThrow.ts',
    'fetch/expectFetchError': 'src/fetch/expectFetchError.ts',
    'import/createCachedDynamicImport': 'src/import/createCachedDynamicImport.ts',
    'logging/Logger': 'src/logging/Logger.ts',
    'time/waitFor': 'src/time/waitFor.ts',
    'time/waitForNot': 'src/time/waitForNot.ts',
    'time/waitForDelay': 'src/time/waitForDelay.ts',
    'url/createRegExpFromURL': 'src/url/createRegExpFromURL.ts',
    'url/createRegExpFromWildcardPath': 'src/url/createRegExpFromWildcardPath.ts',
    'url/excludeURLParams': 'src/url/excludeURLParams.ts',
    'url/joinURL': 'src/url/joinURL.ts',
    'url/validateURLPathParams': 'src/url/validateURLPathParams.ts',
    'url/validateURLProtocol': 'src/url/validateURLProtocol.ts',
  },
}));

export default defineConfig([...neutralConfig]);
