import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTimesWebSocketMessageHandlerTests } from './shared/times';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Times', ({ type, Handler }) => {
  declareTimesWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
