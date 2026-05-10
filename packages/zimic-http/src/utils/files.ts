import fs from 'fs';
import path from 'path';

export function replaceFileExtension(filePath: string, newExtension: string) {
  const parsedFilePath = path.parse(filePath);
  return path.join(parsedFilePath.dir, `${parsedFilePath.name}.${newExtension}`);
}

export async function pathExists(path: string) {
  try {
    await fs.promises.access(path, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensurePathExists(path: string, options: { errorMessage: string }) {
  try {
    await fs.promises.access(path, fs.constants.R_OK);
  } catch (accessError) {
    const error = new Error(options.errorMessage);
    error.cause = accessError;
    throw error;
  }
}
