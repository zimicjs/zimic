import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareBaseURLHttpInterceptorTests } from './shared/baseURLs';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Base URLs', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });
  const otherServer = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;
  let otherBaseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await Promise.all([server.start(), otherServer.start()]);
    }
    baseURL = getNodeBaseURL(type, server);
    otherBaseURL = getNodeBaseURL(type, otherServer);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await Promise.all([server.stop(), otherServer.stop()]);
    }
  });

  declareBaseURLHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getOtherBaseURL: () => otherBaseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
