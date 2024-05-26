import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', () => {
  const server = createInternalInterceptorServer();

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
