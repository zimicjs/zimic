import fs from 'fs';
import os from 'os';
import path from 'path';

import { pathExists } from '@/utils/files';

interface ZimicConfigDirectories {
  path: string;
  server: {
    path: string;
    tokens: { path: string };
  };
}

export async function getOrCreateConfigDirectories(zimicDirectory: string): Promise<ZimicConfigDirectories> {
  const serverConfigDirectory = path.join(zimicDirectory, 'interceptor', 'server');
  const serverConfigDirectoryExists = await pathExists(serverConfigDirectory);

  if (!serverConfigDirectoryExists) {
    await fs.promises.mkdir(serverConfigDirectory, { mode: 0o700, recursive: true });

    const gitIgnoreLine = `*${os.EOL}`;
    await fs.promises.writeFile(path.join(zimicDirectory, '.gitignore'), gitIgnoreLine);
  }

  const tokensFilePath = path.join(serverConfigDirectory, 'tokens');

  return {
    path: zimicDirectory,
    server: {
      path: serverConfigDirectory,
      tokens: { path: tokensFilePath },
    },
  };
}
