async function blobContains(blob: Blob, otherBlob: Blob) {
  return (
    blob.type === otherBlob.type && blob.size >= otherBlob.size && (await blob.text()).includes(await otherBlob.text())
  );
}

export default blobContains;
