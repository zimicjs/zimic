import { describe } from 'vitest';

import Server from '@/server/Server';
import { getNodeBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpInterceptorTests } from './shared/interceptorTests';

describe('HttpInterceptor (Node.js)', () => {
  const server = new Server();

  declareSharedHttpInterceptorTests({
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
