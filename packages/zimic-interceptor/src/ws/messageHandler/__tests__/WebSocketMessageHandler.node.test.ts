import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareDefaultWebSocketMessageHandlerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketMessageHandler (node, $type)', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareDefaultWebSocketMessageHandlerTests({
    platform: 'node',
    type,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
