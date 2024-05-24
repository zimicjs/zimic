import { describe } from 'vitest';

import InterceptorServer from '@/interceptor/server/InterceptorServer';
import { getNodeBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', () => {
  const server = new InterceptorServer();

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
