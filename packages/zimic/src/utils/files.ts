import { blobEquals } from './blob';

export async function getFile() {
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global file and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return globalThis.File ?? (await import('buffer')).File;
}

export async function fileEquals(file: File, otherFile: File) {
  return file.name === otherFile.name && (await blobEquals(file, otherFile));
}
