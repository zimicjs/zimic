import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareWebSocketInterceptorLifecycleTests } from './shared/lifecycle';

describe('WebSocketInterceptor (node) > Lifecycle', () => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareWebSocketInterceptorLifecycleTests({
    platform: 'node',
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
