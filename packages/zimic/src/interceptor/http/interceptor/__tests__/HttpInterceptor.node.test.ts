import { describe } from 'vitest';

import Server from '@/cli/server/Server';
import { getNodeAccessResources } from '@tests/utils/workers';

import { declareSharedHttpInterceptorTests } from './shared/interceptorTests';

describe('HttpInterceptor (Node.js)', () => {
  const server = new Server();

  declareSharedHttpInterceptorTests({
    platform: 'node',

    async startServer() {
      await server.start();
    },

    getAccessResources(type) {
      return getNodeAccessResources(type, server);
    },

    async stopServer() {
      await server.stop();
    },
  });
});
