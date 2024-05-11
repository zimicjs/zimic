import { describe } from 'vitest';

import Server from '@/server/Server';
import { getNodeBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', () => {
  const server = new Server();

  declareSharedHttpInterceptorWorkerTests({
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
