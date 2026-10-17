import { describe, inject } from 'vitest';

import { declareAuthenticationWebSocketInterceptorTests } from './shared/authentication';

describe('WebSocketInterceptor (browser, remote) > Authentication', () => {
  const authenticatedServer = inject('authenticatedInterceptorServer');

  declareAuthenticationWebSocketInterceptorTests({
    platform: 'browser',
    getServerURL: () => authenticatedServer.url.replace(/^http/, 'ws'),
    getValidToken: () => authenticatedServer.token,
  });
});
