import { beforeAll, afterAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareUnhandledMessageFactoriesWebSocketInterceptorTests } from './shared/unhandledMessages.factories';
import { declareUnhandledMessageLoggingWebSocketInterceptorTests } from './shared/unhandledMessages.logging';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Unhandled messages', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await server.start();
    }
    baseURL = getNodeBaseURL(type, server).replace(/^http/, 'ws');
  });

  afterAll(async () => {
    if (type === 'remote') {
      await server.stop();
    }
  });

  describe('Logging', () => {
    declareUnhandledMessageLoggingWebSocketInterceptorTests({
      platform: 'node',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });

  describe('Factories', () => {
    declareUnhandledMessageFactoriesWebSocketInterceptorTests({
      platform: 'node',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });
});
