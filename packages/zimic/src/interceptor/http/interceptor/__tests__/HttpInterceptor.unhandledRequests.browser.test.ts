import { beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareUnhandledRequestFactoriesHttpInterceptorTests } from './shared/unhandledRequests.factories';
import { declareUnhandledRequestLoggingHttpInterceptorTests } from './shared/unhandledRequests.logging';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Unhandled requests', ({ type }) => {
  let baseURL: ExtendedURL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  describe('Logging', async () => {
    await declareUnhandledRequestLoggingHttpInterceptorTests({
      platform: 'browser',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });

  describe('Factories', async () => {
    await declareUnhandledRequestFactoriesHttpInterceptorTests({
      platform: 'browser',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });
});
