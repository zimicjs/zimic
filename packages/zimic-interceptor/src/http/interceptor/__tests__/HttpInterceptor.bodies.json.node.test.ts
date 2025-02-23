import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareJSONBodyHttpInterceptorTests } from './shared/bodies/json';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Bodies > Json', async ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: URL;

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

  await declareJSONBodyHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
