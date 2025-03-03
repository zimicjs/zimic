async function blobEquals(blob: Blob, otherBlob: Blob) {
  return (
    blob.type === otherBlob.type && blob.size === otherBlob.size && (await blob.text()) === (await otherBlob.text())
  );
}

export default blobEquals;
