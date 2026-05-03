import { createCachedDynamicImport } from '@zimic/utils/import';
import type fs from 'fs';

export const importFilesystem = createCachedDynamicImport<typeof fs>(() => import('fs'));

export async function pathExists(path: string) {
  const fs = await importFilesystem();

  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
