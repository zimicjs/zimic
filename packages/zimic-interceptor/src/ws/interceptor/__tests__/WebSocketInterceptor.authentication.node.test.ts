import { afterEach, beforeEach, describe } from 'vitest';

import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  removeInterceptorToken,
} from '@/server/utils/auth';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareAuthenticationWebSocketInterceptorTests } from './shared/authentication';

describe('WebSocketInterceptor (node, remote) > Authentication', () => {
  const server = createInternalInterceptorServer({
    tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    logUnhandledRequests: false,
  });

  let token: Awaited<ReturnType<typeof createInterceptorToken>>;

  beforeEach(async () => {
    token = await createInterceptorToken();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    await removeInterceptorToken(token.id);
  });

  declareAuthenticationWebSocketInterceptorTests({
    platform: 'node',
    getBaseURL: () => `ws://localhost:${server.port}/chat`,
    getValidToken: () => token.value,
  });
});
