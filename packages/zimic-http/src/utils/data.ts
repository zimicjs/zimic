export async function blobEquals(blob: Blob, otherBlob: Blob) {
  return (
    blob.type === otherBlob.type && blob.size === otherBlob.size && (await blob.text()) === (await otherBlob.text())
  );
}

export function isDefined<Value>(value: Value): value is NonNullable<Value> {
  return value !== undefined && value !== null;
}

export function isNonEmpty<Value>(value: Value): value is Exclude<NonNullable<Value>, ''> {
  return isDefined(value) && value !== '';
}
