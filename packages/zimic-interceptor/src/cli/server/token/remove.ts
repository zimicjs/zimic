import color from 'picocolors';

import { readInterceptorTokenFromFile, removeInterceptorToken } from '@/server/utils/auth';
import { logger } from '@/utils/logging';

interface InterceptorServerCreateTokenOptions {
  tokenId: string;
  tokensDirectory: string;
}

export async function removeInterceptorServerToken({ tokenId, tokensDirectory }: InterceptorServerCreateTokenOptions) {
  const token = await readInterceptorTokenFromFile(tokenId, { tokensDirectory });

  if (!token) {
    logger.error(`${color.red(color.bold('✘'))} Token ${color.red(tokenId)} not found.`);
    process.exit(1);
  }

  await removeInterceptorToken(token.id, { tokensDirectory });

  logger.info(`${color.green(color.bold('✔'))} Token ${color.green(token.name ?? token.id)} removed.`);
}
