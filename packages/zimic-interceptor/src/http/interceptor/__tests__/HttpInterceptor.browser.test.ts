import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDeclareHttpInterceptorTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type)', ({ type }) => {
  let baseURL: URL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareDeclareHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
