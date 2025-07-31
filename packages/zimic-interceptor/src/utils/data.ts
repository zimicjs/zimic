import { isClientSide } from './environment';

export function convertArrayBufferToBlob(buffer: ArrayBuffer, options?: BlobPropertyBag): Blob {
  return new Blob([buffer], options);
}

export async function convertReadableStreamToBlob(
  stream: ReadableStream<Uint8Array>,
  options?: BlobPropertyBag,
): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let streamByteLength = 0;

  const reader = stream.getReader();

  while (true) {
    const result = await reader.read();

    if (result.value) {
      chunks.push(result.value);
      streamByteLength += result.value.byteLength;
    }

    if (result.done) {
      break;
    }
  }

  const buffer = new ArrayBuffer(streamByteLength);
  const bufferView = new Uint8Array(buffer);
  let bufferOffset = 0;

  for (const chunk of chunks) {
    bufferView.set(chunk, bufferOffset);
    bufferOffset += chunk.byteLength;
  }

  return convertArrayBufferToBlob(buffer, options);
}

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

export const HEX_REGEX = /^[a-z0-9]+$/;

export function convertHexLengthToByteLength(hexLength: number) {
  return Math.ceil(hexLength / 2); // 1 byte = 2 hex characters
}

export const BASE64URL_REGEX = /^[a-zA-Z0-9-_]+$/;

export function convertHexLengthToBase64urlLength(hexLength: number) {
  const byteLength = convertHexLengthToByteLength(hexLength);
  return Math.ceil((byteLength * 4) / 3); // 1 byte = 4/3 base64url characters
}
