import { NodeWebSocket, NodeXHR } from 'socket.io-client';
import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from '../../interceptor/__tests__/shared/matrix';
import { declareValidationSocketIOProtocolTests } from './shared/validation';

describe.each(testMatrix)('SocketIOProtocol (node, $type) > Validation', ({ type }) => {
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

  declareValidationSocketIOProtocolTests({
    type,
    getBaseURL: () => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
    PollingTransport: NodeXHR,
    WebSocketTransport: NodeWebSocket,
  });
});
