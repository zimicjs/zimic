import { afterAll, beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareFormDataBodyHttpInterceptorTests } from './shared/bodies/formData';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (node, $type) > Form data', async ({ type }) => {
  const server = createInternalInterceptorServer({
    onUnhandledRequest: { action: 'reject', log: false },
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

  await declareFormDataBodyHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
