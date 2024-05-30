export async function getFile() {
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global file and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return globalThis.File ?? (await import('buffer')).File;
}
