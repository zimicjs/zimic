import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareSharedHttpRequestHandlerTests } from './shared';

describe('HttpRequestHandler (Node.js)', () => {
  const server = createInternalInterceptorServer();

  declareSharedHttpRequestHandlerTests({
    platform: 'node',

    async startServer() {
      await server.start();
    },

    getBaseURL(type) {
      return getNodeBaseURL(type, server);
    },

    async stopServer() {
      await server.stop();
    },
  });
});
