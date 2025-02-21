import { createCachedDynamicImport } from './imports';

export const importBuffer = createCachedDynamicImport(
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global file and the buffer import won't run. */
  () => import('buffer'),
);

let FileSingleton: typeof File | undefined;

export async function importFile() {
  /* istanbul ignore if -- @preserve
   * Ignoring as this will only run if this function is called more than once. */
  if (FileSingleton) {
    return FileSingleton;
  }

  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global File and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  FileSingleton = globalThis.File ?? (await importBuffer()).File;
  return FileSingleton;
}
