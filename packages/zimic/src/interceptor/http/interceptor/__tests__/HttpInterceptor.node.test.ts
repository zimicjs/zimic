import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareSharedHttpInterceptorTests } from './shared';

describe('HttpInterceptor (Node.js)', () => {
  const server = createInternalInterceptorServer();

  declareSharedHttpInterceptorTests({
    platform: 'node',
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
