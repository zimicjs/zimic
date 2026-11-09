import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareProtocolWebSocketInterceptorTests } from './shared/protocol';

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Protocol', ({ type }) => {
  declareProtocolWebSocketInterceptorTests({
    type,
    getBaseURL: () => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
