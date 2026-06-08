import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareBaseURLWebSocketInterceptorTests } from './shared/baseURLs';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Base URLs', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareBaseURLWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
