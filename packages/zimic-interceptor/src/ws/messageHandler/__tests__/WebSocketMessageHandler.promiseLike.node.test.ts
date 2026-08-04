import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declarePromiseLikeWebSocketMessageHandlerTests } from './shared/promiseLike';

describe.each(testMatrix.filter(({ type }) => type === 'remote'))(
  'WebSocketMessageHandler (node, $type) > Promise-like',
  ({ type, Handler }) => {
    const server = createInternalInterceptorServer({ logUnhandledRequests: false });

    declarePromiseLikeWebSocketMessageHandlerTests({
      platform: 'node',
      type,
      Handler,
      startServer: () => server.start(),
      stopServer: () => server.stop(),
      getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
    });
  },
);
