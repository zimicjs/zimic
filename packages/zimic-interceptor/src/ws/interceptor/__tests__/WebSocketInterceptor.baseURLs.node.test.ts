import { beforeAll, afterAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareBaseURLWebSocketInterceptorTests } from './shared/baseURLs';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Base URLs', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });
  const otherServer = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;
  let otherBaseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await Promise.all([server.start(), otherServer.start()]);
    }
    baseURL = getNodeBaseURL(type, server).replace(/^http/, 'ws');
    otherBaseURL = getNodeBaseURL(type, otherServer).replace(/^http/, 'ws');
  });

  afterAll(async () => {
    if (type === 'remote') {
      await Promise.all([server.stop(), otherServer.stop()]);
    }
  });

  declareBaseURLWebSocketInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getOtherBaseURL: type === 'remote' ? () => otherBaseURL : undefined,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
