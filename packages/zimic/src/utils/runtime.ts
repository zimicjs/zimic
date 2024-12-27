export function getCurrentStack() {
  return new Error().stack;
}
