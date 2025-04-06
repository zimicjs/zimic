import fs from 'fs';

import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } from '@/server/utils/auth';

export async function clearInterceptorTokens(tokensDirectory = DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY) {
  await fs.promises.rm(tokensDirectory, { force: true, recursive: true });
}
