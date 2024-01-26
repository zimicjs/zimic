export async function getCrypto() {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  return globalCrypto ?? (await import('node:crypto'));
}
