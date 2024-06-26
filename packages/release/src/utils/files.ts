import filesystem from 'fs/promises';

export async function pathExists(path: string) {
  try {
    await filesystem.access(path);
    return true;
  } catch {
    return false;
  }
}
