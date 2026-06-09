import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTypeWebSocketInterceptorTests } from './shared/types';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Types', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareTypeWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
  });
});
