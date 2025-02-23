import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareLifeCycleHttpInterceptorTests } from './shared/lifeCycle';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Life cycle', ({ type }) => {
  let baseURL: URL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareLifeCycleHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
