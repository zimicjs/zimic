import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareActionWebSocketMessageHandlerTests } from './shared/actions';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Actions', ({ type, Handler }) => {
  declareActionWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
