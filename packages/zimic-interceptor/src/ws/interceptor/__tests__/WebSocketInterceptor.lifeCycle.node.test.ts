import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareLifeCycleWebSocketInterceptorTests } from './shared/lifeCycle';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Life cycle', ({ type }) => {
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

  declareLifeCycleWebSocketInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
