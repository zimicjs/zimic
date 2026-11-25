import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareClearWebSocketInterceptorTests } from './shared/clear';
import interceptorTestMatrix from './shared/matrix';

describe.each(interceptorTestMatrix)('WebSocketInterceptor (browser, $type) > Clear', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareClearWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
