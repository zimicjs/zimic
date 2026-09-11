import { describe, inject } from 'vitest';

import { declareAuthenticationHttpInterceptorTests } from './shared/authentication';

describe('HttpInterceptor (browser, remote) > Authentication', () => {
  const authenticatedServer = inject('authenticatedInterceptorServer');

  declareAuthenticationHttpInterceptorTests({
    platform: 'browser',
    getServerURL: () => authenticatedServer.url,
    getValidToken: () => authenticatedServer.token,
  });
});
