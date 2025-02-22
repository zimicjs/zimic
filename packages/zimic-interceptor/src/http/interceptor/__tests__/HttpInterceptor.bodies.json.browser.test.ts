import { beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareJSONBodyHttpInterceptorTests } from './shared/bodies/json';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bodies > Json', async ({ type }) => {
  let baseURL: ExtendedURL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  await declareJSONBodyHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
