import { beforeAll, afterAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareTimesWebSocketInterceptorTests } from './shared/times';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Times', ({ type }) => {
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

  declareTimesWebSocketInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
