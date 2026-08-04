import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDefaultWebSocketInterceptorTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type)', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareDefaultWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
