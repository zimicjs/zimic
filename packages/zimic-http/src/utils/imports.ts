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
