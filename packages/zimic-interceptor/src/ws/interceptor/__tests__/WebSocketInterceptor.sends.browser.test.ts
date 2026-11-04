import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareSendsWebSocketInterceptorTests } from './shared/sends';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Sends', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareSendsWebSocketInterceptorTests({
    type,
    getBaseURL: () => baseURL,
  });
});
