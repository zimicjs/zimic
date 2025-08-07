import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTypeHttpInterceptorTests } from './shared/types';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Types', ({ type }) => {
  let baseURL: string;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareTypeHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
  });
});
