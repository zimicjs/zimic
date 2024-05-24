import { describe } from 'vitest';

import InterceptorServer from '@/interceptor/server/InterceptorServer';
import { getNodeBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpInterceptorTests } from './shared/interceptorTests';

describe('HttpInterceptor (Node.js)', () => {
  const server = new InterceptorServer();

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
