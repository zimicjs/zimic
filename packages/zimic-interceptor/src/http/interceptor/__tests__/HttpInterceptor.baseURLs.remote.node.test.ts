import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareRemoteBaseURLHttpInterceptorTests } from './shared/baseURLs.remote';

describe('HttpInterceptor (node, remote) > Base URLs', () => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;

  beforeAll(async () => {
    await server.start();
    baseURL = getNodeBaseURL('remote', server);
  });

  afterAll(async () => {
    await server.stop();
  });

  declareRemoteBaseURLHttpInterceptorTests({
    getBaseURL: () => baseURL,
  });
});
