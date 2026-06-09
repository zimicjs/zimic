import { beforeAll, afterAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareTypeWebSocketInterceptorTests } from './shared/types';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Types', ({ type }) => {
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

  declareTypeWebSocketInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
  });
});
