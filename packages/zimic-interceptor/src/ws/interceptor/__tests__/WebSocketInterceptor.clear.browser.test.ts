import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import messageHandlerTestMatrix from '../../messageHandler/__tests__/shared/matrix';
import { declareClearWebSocketInterceptorTests, declareDirectWebSocketMessageHandlerClearTests } from './shared/clear';
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

describe.each(messageHandlerTestMatrix)(
  'WebSocketMessageHandler (browser, $type) > Clear while handling',
  ({ type, Handler }) => {
    declareDirectWebSocketMessageHandlerClearTests({
      type,
      Handler,
    });
  },
);
