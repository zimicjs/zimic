import { describe } from 'vitest';

import InterceptorServer from '@/interceptor/server/InterceptorServer';
import { getNodeBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpRequestHandlerTests } from './shared/requestHandlerTests';

describe('HttpRequestHandler (Node.js)', () => {
  const server = new InterceptorServer();

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
