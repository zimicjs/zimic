import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareHandlerWebSocketInterceptorTests } from './shared/handlers';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Handlers', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareHandlerWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
