import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDefaultBodyHttpInterceptorTests } from './shared/bodies/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bodies', ({ type }) => {
  let baseURL: string;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareDefaultBodyHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
