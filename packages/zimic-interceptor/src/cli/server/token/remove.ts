import color from 'picocolors';

import {
  createInterceptorTokensDirectory,
  readInterceptorTokenFromFile,
  removeInterceptorToken,
} from '@/server/utils/auth';
import { logWithPrefix } from '@/utils/console';
import { pathExists } from '@/utils/files';

interface InterceptorServerCreateTokenOptions {
  tokenId: string;
  tokensDirectory: string;
}

export async function removeInterceptorServerToken({ tokenId, tokensDirectory }: InterceptorServerCreateTokenOptions) {
  const tokensDirectoryExists = await pathExists(tokensDirectory);

  if (!tokensDirectoryExists) {
    await createInterceptorTokensDirectory(tokensDirectory);
  }

  const token = await readInterceptorTokenFromFile(tokenId, { tokensDirectory });

  if (!token) {
    logWithPrefix(`${color.red(color.bold('✘'))} Token ${color.red(tokenId)} not found.`);
    return;
  }

  await removeInterceptorToken(tokenId, { tokensDirectory });

  logWithPrefix(`${color.green(color.bold('✔'))} Token ${color.green(token.name ?? tokenId)} removed.`);
}
