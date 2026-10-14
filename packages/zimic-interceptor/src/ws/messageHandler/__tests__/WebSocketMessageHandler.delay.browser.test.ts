import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDelayWebSocketMessageHandlerTests } from './shared/delay';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Delay', ({ type, Handler }) => {
  declareDelayWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
