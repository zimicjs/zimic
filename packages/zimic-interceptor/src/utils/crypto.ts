import { createCachedDynamicImport } from '@zimic/utils/import';

export type IsomorphicCrypto = Crypto | typeof import('crypto');

export const importCrypto = createCachedDynamicImport<IsomorphicCrypto>(async () => {
  const globalCrypto = globalThis.crypto as typeof globalThis.crypto | undefined;
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global crypto and the import fallback won't run. */
  return globalCrypto ?? (await import('crypto'));
});
