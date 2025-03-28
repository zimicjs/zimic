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
  tokenLength: number;
}

export async function createInterceptorServerToken({
  tokensDirectory,
  tokenLength,
}: CreateInterceptorServerTokenOptions) {
  const tokensDirectoryExists = await pathExists(tokensDirectory);

  if (!tokensDirectoryExists) {
    await createInterceptorTokensDirectory(tokensDirectory);
  }

  const token = await createInterceptorToken({ length: tokenLength });
  const tokenFile = await saveInterceptorTokenToFile(tokensDirectory, token);

  logWithPrefix(
    [
      `${color.green(color.bold('✔'))} Token created:`,
      '',
      `  ${color.yellow(token.value)}`,
      '',
      'Remote interceptors can use this token to authenticate with this server. Store it securely. It cannot be ' +
        'retrieved later.',
      '',
      `A secure hash of this token was saved to ${color.yellow(tokenFile)}. When starting your interceptor server, ` +
        'use the `--tokens-dir` option as follows. Only the tokens in this directory will be accepted for remote ' +
        'interceptor authentication.',
      '',
      `  $ zimic-interceptor server start --tokens-dir ${tokensDirectory}`,
      '',
      'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
    ].join('\n'),
  );
}
