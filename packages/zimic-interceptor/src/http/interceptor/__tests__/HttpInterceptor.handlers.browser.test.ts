import { beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareHandlerHttpInterceptorTests } from './shared/handlers';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bypass', async ({ type }) => {
  let baseURL: ExtendedURL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  await declareHandlerHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
