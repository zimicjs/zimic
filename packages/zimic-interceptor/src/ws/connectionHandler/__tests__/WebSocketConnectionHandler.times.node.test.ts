import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareTimesWebSocketConnectionHandlerTests } from './shared/times';

describe.each(testMatrix)('WebSocketConnectionHandler (node, $type) > Times', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareTimesWebSocketConnectionHandlerTests({
    platform: 'node',
    type,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
