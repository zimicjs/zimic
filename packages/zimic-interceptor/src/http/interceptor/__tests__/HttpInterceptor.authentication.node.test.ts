import { afterEach, beforeEach, describe } from 'vitest';

import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  InterceptorToken,
  removeInterceptorToken,
} from '@/server/utils/auth';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareAuthenticationHttpInterceptorTests } from './shared/authentication';

describe('HttpInterceptor (node, remote) > Authentication', () => {
  const server = createInternalInterceptorServer({
    tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    logUnhandledRequests: false,
  });

  let token: InterceptorToken;

  beforeEach(async () => {
    token = await createInterceptorToken();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    await removeInterceptorToken(token.id);
  });

  declareAuthenticationHttpInterceptorTests({
    platform: 'node',
    getServerURL: () => `http://localhost:${server.port}`,
    getValidToken: () => token.value,
  });
});
