import { blobEquals } from './blob';
import { isClientSide } from './environment';

export async function getFile() {
  /* istanbul ignore next -- @preserve
   * Ignoring as Node.js >=20 provides a global file and the import fallback won't run. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return globalThis.File ?? (await import('buffer')).File;
}

export async function fileEquals(file: File, otherFile: File) {
  return file.name === otherFile.name && (await blobEquals(file, otherFile));
}

export function convertArrayBufferToBase64(buffer: ArrayBuffer) {
  if (isClientSide()) {
    const bufferAsString = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(bufferAsString);
  } else {
    return Buffer.from(buffer).toString('base64');
  }
}

export function convertBase64ToArrayBuffer(base64Value: string) {
  if (isClientSide()) {
    const bufferAsString = atob(base64Value);
    const array = Uint8Array.from(bufferAsString, (character) => character.charCodeAt(0));
    return array.buffer;
  } else {
    return Buffer.from(base64Value, 'base64');
  }
}
