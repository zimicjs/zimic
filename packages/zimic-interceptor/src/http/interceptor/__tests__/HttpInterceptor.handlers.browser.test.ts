import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareHandlerHttpInterceptorTests } from './shared/handlers';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Handlers', ({ type }) => {
  let baseURL: string;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareHandlerHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
