import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareUnhandledMessageWebSocketInterceptorTests } from './shared/unhandledMessages';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Unhandled messages', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareUnhandledMessageWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
