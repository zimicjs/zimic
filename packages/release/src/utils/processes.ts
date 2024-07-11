let execaSingleton: typeof import('execa') | undefined;

export async function importExeca() {
  if (!execaSingleton) {
    execaSingleton = await import('execa');
  }
  return execaSingleton;
}
