function createCachedDynamicImport<ImportType>(
  importModuleDynamically: () => Promise<ImportType>,
): () => Promise<ImportType> {
  let cachedImportResult: ImportType | undefined;

  return async function importModuleDynamicallyWithCache() {
    cachedImportResult ??= await importModuleDynamically();
    return cachedImportResult;
  };
}

export default createCachedDynamicImport;
