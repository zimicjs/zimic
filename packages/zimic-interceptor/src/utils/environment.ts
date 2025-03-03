export function isServerSide() {
  return typeof process !== 'undefined' && typeof process.versions !== 'undefined';
}

export function isClientSide() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
