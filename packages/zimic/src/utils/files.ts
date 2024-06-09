import { blobEquals } from './data';

let bufferSingleton: typeof import('buffer') | undefined;

/* istanbul ignore next -- @preserve
 * Ignoring as Node.js >=20 provides a global file and the buffer import won't run. */
export async function importBuffer() {
  if (bufferSingleton) {
    return bufferSingleton;
  }
  bufferSingleton = await import('buffer');
  return bufferSingleton;
}

let FileSingleton: typeof File | undefined;

export async function importFile() {
  if (FileSingleton) {
    return FileSingleton;
  }

  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global file and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  FileSingleton = globalThis.File ?? (await importBuffer()).File;
  return FileSingleton;
}

export async function fileEquals(file: File, otherFile: File) {
  return file.name === otherFile.name && (await blobEquals(file, otherFile));
}
