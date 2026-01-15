import { createCachedDynamicImport } from '@zimic/utils/import';

export const importFile = createCachedDynamicImport(
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global File and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  async () => globalThis.File ?? (await import('buffer')).File,
);
