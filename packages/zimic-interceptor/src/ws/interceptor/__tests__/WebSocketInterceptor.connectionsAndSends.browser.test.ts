import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareConnectionAndSendWebSocketInterceptorTests } from './shared/connectionsAndSends';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Connections and sends', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareConnectionAndSendWebSocketInterceptorTests({ type, getBaseURL: () => baseURL });
});
