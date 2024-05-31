export async function blobEquals(blob: Blob, otherBlob: Blob) {
  return (
    blob.type === otherBlob.type && blob.size === otherBlob.size && (await blob.text()) === (await otherBlob.text())
  );
}

export async function blobContains(blob: Blob, otherBlob: Blob) {
  return (
    blob.type === otherBlob.type && blob.size >= otherBlob.size && (await otherBlob.text()).includes(await blob.text())
  );
}
