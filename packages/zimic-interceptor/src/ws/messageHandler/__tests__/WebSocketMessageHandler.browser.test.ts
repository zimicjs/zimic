import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDefaultWebSocketMessageHandlerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type)', ({ type, Handler }) => {
  declareDefaultWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
