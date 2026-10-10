import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareActionWebSocketMessageHandlerTests } from './shared/actions';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Actions', ({ type }) => {
  declareActionWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
