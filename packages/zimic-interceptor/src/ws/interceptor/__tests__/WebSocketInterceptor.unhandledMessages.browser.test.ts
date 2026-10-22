import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareUnhandledMessageFactoriesWebSocketInterceptorTests } from './shared/unhandledMessages.factories';
import { declareUnhandledMessageLoggingWebSocketInterceptorTests } from './shared/unhandledMessages.logging';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Unhandled messages', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  describe('Logging', () => {
    declareUnhandledMessageLoggingWebSocketInterceptorTests({
      platform: 'browser',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });

  describe('Factories', () => {
    declareUnhandledMessageFactoriesWebSocketInterceptorTests({
      platform: 'browser',
      type,
      getBaseURL: () => baseURL,
      getInterceptorOptions: () => ({ type, baseURL }),
    });
  });
});
