import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareClearHttpInterceptorTests } from './shared/clear';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Clear', ({ type }) => {
  let baseURL: URL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareClearHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
