import { afterAll, beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareTypeHttpInterceptorTests } from './shared/types';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Types', ({ type }) => {
  const server = createInternalInterceptorServer();

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

  declareTypeHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
  });
});
