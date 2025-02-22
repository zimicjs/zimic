/* istanbul ignore next -- @preserve
 * Ignoring as Node.js >=20 provides globals that may cause this dynamic import to not run. */
export function createCachedDynamicImport<ImportType>(
  importModuleDynamically: () => Promise<ImportType>,
): () => Promise<ImportType> {
  let cachedImportResult: ImportType | undefined;

  return async function importModuleDynamicallyWithCache() {
    if (cachedImportResult === undefined) {
      cachedImportResult = await importModuleDynamically();
    }
    return cachedImportResult;
  };
}
