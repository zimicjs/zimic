import { createCachedDynamicImport } from './imports';

export const importBuffer = createCachedDynamicImport(
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global file and the buffer import won't run. */
  () => import('buffer'),
);

export function isGlobalFileAvailable() {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return globalThis.File !== undefined;
}

let FileSingleton: typeof File | undefined;

export async function importFile() {
  if (FileSingleton) {
    return FileSingleton;
  }

  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global File and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  FileSingleton = globalThis.File ?? (await importBuffer()).File;
  return FileSingleton;
}
