import color from 'picocolors';

import {
  createInterceptorToken,
  createInterceptorTokensDirectory,
  saveInterceptorTokenToFile,
} from '@/server/utils/auth';
import { pathExists } from '@/utils/files';
import { logger } from '@/utils/logging';

interface InterceptorServerCreateTokenOptions {
  tokenName?: string;
  tokensDirectory: string;
}

export async function createInterceptorServerToken({
  tokenName,
  tokensDirectory,
}: InterceptorServerCreateTokenOptions) {
  const tokensDirectoryExists = await pathExists(tokensDirectory);

  if (!tokensDirectoryExists) {
    await createInterceptorTokensDirectory(tokensDirectory);
  }

  const token = await createInterceptorToken({ tokenName });
  await saveInterceptorTokenToFile(tokensDirectory, token);

  logger.info(
    [
      `${color.green(color.bold('✔'))} Token${tokenName ? ` ${color.green(tokenName)}` : ''} created:`,
      '',
      color.yellow(token.value),
      '',
      'Store this token securely. It cannot be retrieved later.',
      '',
      'To enable authentication in your interceptor server, ' +
        `use the ${color.cyan('--tokens-dir')} option. Only remote interceptors bearing a valid token will be ` +
        'allowed to connect.',
      '',
      `${color.dim('$')} zimic-interceptor server start ${color.cyan('--tokens-dir')} ${color.magenta(tokensDirectory)}`,
      '',
      'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
    ].join('\n'),
  );

  return token;
}
