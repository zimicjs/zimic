import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareDelayWebSocketInterceptorTests } from './shared/delay';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Delay', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  beforeAll(async () => {
    if (type === 'remote') {
      await server.start();
    }
  });

  afterAll(async () => {
    if (type === 'remote') {
      await server.stop();
    }
  });

  declareDelayWebSocketInterceptorTests({
    type,
    getBaseURL: () => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
