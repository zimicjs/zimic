import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareUnhandledRequestFactoriesHttpInterceptorTests } from './shared/unhandledRequests.factories';
import { declareUnhandledRequestLoggingHttpInterceptorTests } from './shared/unhandledRequests.logging';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Unhandled requests', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;

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

  describe('Logging', () => {
    declareUnhandledRequestLoggingHttpInterceptorTests({
      platform: 'node',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });

  describe('Factories', () => {
    declareUnhandledRequestFactoriesHttpInterceptorTests({
      platform: 'node',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });
});
