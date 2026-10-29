import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTypeAssertionWebSocketMessageHandlerTests } from './shared/typeAssertions';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Types', ({ type }) => {
  declareTypeAssertionWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
