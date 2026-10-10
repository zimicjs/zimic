import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareActionWebSocketMessageHandlerTests } from './shared/actions';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketMessageHandler (node, $type) > Actions', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareActionWebSocketMessageHandlerTests({
    platform: 'node',
    type,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
