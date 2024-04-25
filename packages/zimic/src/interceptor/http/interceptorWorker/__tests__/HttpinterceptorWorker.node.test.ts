import { describe } from 'vitest';

import Server from '@/cli/server/Server';
import { getNodeAccessResources } from '@tests/utils/workers';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', () => {
  const server = new Server();

  declareSharedHttpInterceptorWorkerTests({
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
