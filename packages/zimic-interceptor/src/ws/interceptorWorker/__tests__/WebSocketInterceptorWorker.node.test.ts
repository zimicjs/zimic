import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareDefaultWebSocketInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

// The HTTP Node suite checks that a local worker removes its MSW handler after the MSW worker fails to start. Local
// WebSocket workers register no MSW handler on start, so there is no WebSocket counterpart.
describe.each(testMatrix)('WebSocketInterceptorWorker (node, $type)', (defaultWorkerOptions) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareDefaultWebSocketInterceptorWorkerTests({
    platform: 'node',
    defaultWorkerOptions,
    // In Node, start errors would be unhandled promise rejections without details, so the worker logs them.
    numberOfLoggedStartErrors: 1,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
