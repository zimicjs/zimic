import createCachedDynamicImport from '@zimic/utils/import/createCachedDynamicImport';
import fs from 'fs';
import path from 'path';

export const importFile = createCachedDynamicImport(
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global File and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  async () => globalThis.File ?? (await import('buffer')).File,
);

export function replaceFileExtension(filePath: string, newExtension: string) {
  const parsedFilePath = path.parse(filePath);
  return path.join(parsedFilePath.dir, `${parsedFilePath.name}.${newExtension}`);
}

export async function pathExists(path: string) {
  try {
    await fs.promises.access(path, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensurePathExists(path: string, options: { errorMessage: string }) {
  try {
    await fs.promises.access(path, fs.constants.R_OK);
  } catch (accessError) {
    const error = new Error(options.errorMessage);
    error.cause = accessError;
    throw error;
  }
}
