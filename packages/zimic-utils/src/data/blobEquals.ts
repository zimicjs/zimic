async function blobEquals(blob: Blob, otherBlob: Blob) {
  if (blob.type !== otherBlob.type || blob.size !== otherBlob.size) {
    return false;
  }

  const reader = blob.stream().getReader();
  const otherReader = otherBlob.stream().getReader();

  let buffer: Uint8Array = new Uint8Array(0);
  let otherBuffer: Uint8Array = new Uint8Array(0);

  try {
    while (true) {
      await Promise.all([
        buffer.length === 0 &&
          reader.read().then((result) => {
            if (!result.done) {
              buffer = result.value;
            }
          }),

        otherBuffer.length === 0 &&
          otherReader.read().then((result) => {
            if (!result.done) {
              otherBuffer = result.value;
            }
          }),
      ]);

      const streamsEndedTogether = buffer.length === 0 && otherBuffer.length === 0;

      if (streamsEndedTogether) {
        return true;
      }

      const oneStreamEndedBeforeTheOther =
        (buffer.length === 0 && otherBuffer.length > 0) || (buffer.length > 0 && otherBuffer.length === 0);

      if (oneStreamEndedBeforeTheOther) {
        return false;
      }

      const minimumByteLength = Math.min(buffer.length, otherBuffer.length);

      for (let byteIndex = 0; byteIndex < minimumByteLength; byteIndex++) {
        if (buffer[byteIndex] !== otherBuffer[byteIndex]) {
          return false;
        }
      }

      buffer = buffer.slice(minimumByteLength);
      otherBuffer = otherBuffer.slice(minimumByteLength);
    }
  } finally {
    reader.releaseLock();
    otherReader.releaseLock();
  }
}

export default blobEquals;
