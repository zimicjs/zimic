import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareBaseURLHttpInterceptorTests } from './shared/baseURLs';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Base URLs', ({ type }) => {
  let baseURL: URL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareBaseURLHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
