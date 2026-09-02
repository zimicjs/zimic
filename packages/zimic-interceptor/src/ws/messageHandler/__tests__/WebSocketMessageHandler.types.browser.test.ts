import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTypeAssertionWebSocketMessageHandlerTests } from './shared/typeAssertions';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Types', ({ type, Handler }) => {
  declareTypeAssertionWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
