import { afterAll, beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareUnhandledRequestHttpInterceptorTests } from './shared/unhandledRequests';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Unhandled requests', ({ type }) => {
  const server = createInternalInterceptorServer({
    logUnhandledRequests: false,
  });

  let baseURL: ExtendedURL;

  beforeAll(async () => {
    if (type === 'remote') {
      await server.start();
    }
    baseURL = await getNodeBaseURL(type, server);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await server.stop();
    }
  });

  declareUnhandledRequestHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
