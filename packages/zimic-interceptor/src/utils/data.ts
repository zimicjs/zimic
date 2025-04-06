import { isClientSide } from './environment';

export function convertArrayBufferToBase64(buffer: ArrayBuffer) {
  if (isClientSide()) {
    const bufferBytes = new Uint8Array(buffer);

    const bufferAsStringArray = [];
    for (const byte of bufferBytes) {
      const byteCode = String.fromCharCode(byte);
      bufferAsStringArray.push(byteCode);
    }
    const bufferAsString = bufferAsStringArray.join('');

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

export function convertHexLengthToByteLength(hexLength: number) {
  return Math.ceil(hexLength / 2); // 1 byte = 2 hex characters
}

export function convertHexLengthToBase64urlLength(hexLength: number) {
  const byteLength = convertHexLengthToByteLength(hexLength);
  return Math.ceil((byteLength * 4) / 3); // 1 byte = 4/3 base64url characters
}
