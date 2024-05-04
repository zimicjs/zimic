export type IsomorphicCrypto = Crypto | typeof import('node:crypto');

export async function getCrypto(): Promise<IsomorphicCrypto> {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global crypto and the import fallback won't run. */
  return globalCrypto ?? (await import('node:crypto'));
}
