import createCachedDynamicImport from '@zimic/utils/import/createCachedDynamicImport';
import type fs from 'fs';

export const importFile = createCachedDynamicImport(
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global File and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  async () => globalThis.File ?? (await import('buffer')).File,
);

export function isGlobalFileAvailable() {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return globalThis.File !== undefined;
}

export const importFilesystem = createCachedDynamicImport<typeof fs>(() => import('fs'));

export async function pathExists(path: string) {
  const fs = await importFilesystem();

  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
