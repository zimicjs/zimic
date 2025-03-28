import color from 'picocolors';

import {
  createInterceptorToken,
  createInterceptorTokensDirectory,
  saveInterceptorTokenToFile,
} from '@/server/utils/auth';
import { logWithPrefix } from '@/utils/console';
import { pathExists } from '@/utils/files';

interface CreateInterceptorServerTokenOptions {
  tokensDirectory: string;
  secretLength: number;
}

export async function createInterceptorServerToken({
  tokensDirectory,
  secretLength,
}: CreateInterceptorServerTokenOptions) {
  const tokensDirectoryExists = await pathExists(tokensDirectory);

  if (!tokensDirectoryExists) {
    await createInterceptorTokensDirectory(tokensDirectory);
  }

  const token = await createInterceptorToken({ secretLength });
  const tokenFile = await saveInterceptorTokenToFile(tokensDirectory, token);

  logWithPrefix(
    [
      `${color.green(color.bold('✔'))} Created token: ${color.yellow(token.plainValue)}`,
      '',
      'Remote interceptors can use this token to authenticate with an interceptor server. Store it securely. It ' +
        'cannot be retrieved later.',
      '',
      `A secure hash was saved to ${color.magenta(tokenFile)}. When starting your interceptor server, ` +
        `use the ${color.cyan('--tokens-dir')} option to enable authentication. Only remote interceptors bearing a ` +
        'valid token will be allowed to connect.',
      '',
      `${color.dim('$')} zimic-interceptor server start ${color.cyan('--tokens-dir')} ${color.magenta(tokensDirectory)}`,
      '',
      'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
    ].join('\n'),
  );
}
