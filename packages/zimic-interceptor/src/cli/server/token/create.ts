import color from 'picocolors';

import { createInterceptorToken } from '@/server/utils/auth';
import { logger } from '@/utils/logging';

interface InterceptorServerCreateTokenOptions {
  tokenName?: string;
  tokensDirectory: string;
}

export async function createInterceptorServerToken({
  tokenName,
  tokensDirectory,
}: InterceptorServerCreateTokenOptions) {
  const token = await createInterceptorToken({ name: tokenName, tokensDirectory });

  logger.info(
    [
      `${color.green(color.bold('✔'))} Token${tokenName ? ` ${color.green(tokenName)}` : ''} created:`,
      '',
      color.yellow(token.value),
      '',
      'Store this token securely. It cannot be retrieved later.',
      '',
      `To enable authentication in your interceptor server, use the ${color.cyan('--tokens-dir')} option as shown ` +
        'below. Only remote interceptors bearing a valid token will be allowed to connect.',
      '',
      `${color.dim('$')} zimic-interceptor server start ${color.cyan('--tokens-dir')} ${color.magenta(tokensDirectory)}`,
      '',
      'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#authentication',
    ].join('\n'),
  );
}
