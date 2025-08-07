import prettier, { Options } from 'prettier';

export async function resolvedPrettierConfig(fileName: string): Promise<Options> {
  const config = await prettier.resolveConfig(fileName);

  /* istanbul ignore if -- @preserve
   * This function is used in tests and they will fail if no config is found. */
  if (config === null) {
    throw new Error('Prettier config not found.');
  }

  return config;
}
