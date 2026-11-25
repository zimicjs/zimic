import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareConnectionSavingWebSocketInterceptorTests } from './shared/connectionSaving';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Connection saving', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareConnectionSavingWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
