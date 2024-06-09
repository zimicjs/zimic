export type IsomorphicCrypto = Crypto | typeof import('crypto');

let cryptoSingleton: IsomorphicCrypto | undefined;

export async function importCrypto(): Promise<IsomorphicCrypto> {
  if (cryptoSingleton) {
    return cryptoSingleton;
  }

  const globalCrypto = globalThis.crypto as typeof globalThis.crypto | undefined;
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global crypto and the import fallback won't run. */
  cryptoSingleton = globalCrypto ?? (await import('crypto'));
  return cryptoSingleton;
}
