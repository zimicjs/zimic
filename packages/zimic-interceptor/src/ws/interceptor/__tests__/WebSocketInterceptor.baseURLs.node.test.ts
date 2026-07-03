import { beforeAll, afterAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareBaseURLWebSocketInterceptorTests } from './shared/baseURLs';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Base URLs', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });
  const alternativeServer = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;
  let alternativeBaseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await Promise.all([server.start(), alternativeServer.start()]);
    }
    baseURL = getNodeBaseURL(type, server).replace(/^http/, 'ws');
    alternativeBaseURL = getNodeBaseURL(type, alternativeServer).replace(/^http/, 'ws');
  });

  afterAll(async () => {
    if (type === 'remote') {
      await Promise.all([server.stop(), alternativeServer.stop()]);
    }
  });

  declareBaseURLWebSocketInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getAlternativeBaseURL: () => alternativeBaseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
