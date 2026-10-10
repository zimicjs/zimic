import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareTimesWebSocketMessageHandlerTests } from './shared/times';

describe.each(testMatrix)('WebSocketMessageHandler (node, $type) > Times', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareTimesWebSocketMessageHandlerTests({
    platform: 'node',
    type,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
