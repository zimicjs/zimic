import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareConnectionAndSendWebSocketInterceptorTests } from './shared/connectionsAndSends';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Connections and sends', ({ type }) => {
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

  declareConnectionAndSendWebSocketInterceptorTests({
    type,
    getBaseURL() {
      return getNodeBaseURL(type, server).replace(/^http/, 'ws');
    },
  });
});
