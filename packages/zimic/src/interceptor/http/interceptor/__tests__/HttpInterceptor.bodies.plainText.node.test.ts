import { afterAll, beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declarePlainTextBodyHttpInterceptorTests } from './shared/bodies/plainText';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Bodies > Plain text', async ({ type }) => {
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

  await declarePlainTextBodyHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
