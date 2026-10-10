import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDelayWebSocketMessageHandlerTests } from './shared/delay';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Delay', ({ type }) => {
  declareDelayWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
