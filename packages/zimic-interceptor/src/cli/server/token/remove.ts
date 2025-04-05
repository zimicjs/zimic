import color from 'picocolors';

import { readInterceptorTokenFromFile, removeInterceptorToken } from '@/server/utils/auth';
import { logWithPrefix } from '@/utils/console';

interface InterceptorServerCreateTokenOptions {
  tokenId: string;
  tokensDirectory: string;
}

export async function removeInterceptorServerToken({ tokenId, tokensDirectory }: InterceptorServerCreateTokenOptions) {
  const token = await readInterceptorTokenFromFile(tokenId, { tokensDirectory });

  if (!token) {
    logWithPrefix(`${color.red(color.bold('✘'))} Token ${color.red(tokenId)} not found.`);
    return;
  }

  await removeInterceptorToken(tokenId, { tokensDirectory });

  logWithPrefix(`${color.green(color.bold('✔'))} Token ${color.green(token.name ?? tokenId)} removed.`);
}
