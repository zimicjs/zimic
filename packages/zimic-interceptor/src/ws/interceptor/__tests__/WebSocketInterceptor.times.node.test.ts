import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareTimesWebSocketInterceptorTests } from './shared/times';

describe('WebSocketInterceptor (node, remote) > Times', () => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  beforeAll(async () => {
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  declareTimesWebSocketInterceptorTests({
    getBaseURL: () => getNodeBaseURL('remote', server).replace(/^http/, 'ws'),
  });
});
