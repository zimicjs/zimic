import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareRemoteBaseURLWebSocketInterceptorTests } from './shared/baseURLs.remote';

describe('WebSocketInterceptor (node, remote) > Base URLs', () => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;

  beforeAll(async () => {
    await server.start();
    baseURL = getNodeBaseURL('remote', server).replace(/^http/, 'ws');
  });

  afterAll(async () => {
    await server.stop();
  });

  declareRemoteBaseURLWebSocketInterceptorTests({
    getBaseURL: () => baseURL,
  });
});
