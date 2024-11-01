import { beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareBypassHttpInterceptorTests } from './shared/bypass';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bypass', ({ type }) => {
  let baseURL: ExtendedURL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareBypassHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
