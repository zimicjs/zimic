import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareSearchParamsBodyHttpInterceptorTests } from './shared/bodies/searchParams';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bodies > Search params', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type);
  });

  declareSearchParamsBodyHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
