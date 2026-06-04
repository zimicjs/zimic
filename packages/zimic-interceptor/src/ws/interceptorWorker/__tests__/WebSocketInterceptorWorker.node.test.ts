import { beforeAll, afterAll, describe } from 'vitest';

import InterceptorServer from '@/server/InterceptorServer';
import { getNodeBaseURL } from '@tests/utils/interceptors';

import { declareLocalWebSocketInterceptorWorkerTests } from './shared/local';

describe('WebSocketInterceptorWorker (node, local)', () => {
  let server: InterceptorServer;

  beforeAll(async () => {
    server = new InterceptorServer({ hostname: 'localhost' });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  declareLocalWebSocketInterceptorWorkerTests({
    platform: 'node',
    getBaseURL: () => getNodeBaseURL('local', server).replace(/^http/, 'ws'),
  });
});
