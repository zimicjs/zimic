import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareTypeAssertionWebSocketMessageHandlerTests } from './shared/typeAssertions';

describe.each(testMatrix)('WebSocketMessageHandler (node, $type) > Types', ({ type, Handler }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareTypeAssertionWebSocketMessageHandlerTests({
    platform: 'node',
    type,
    Handler,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
