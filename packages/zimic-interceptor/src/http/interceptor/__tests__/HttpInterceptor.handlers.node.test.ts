import { afterAll, beforeAll, describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareHandlerHttpInterceptorTests } from './shared/handlers';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Handlers', async ({ type }) => {
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

  await declareHandlerHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
