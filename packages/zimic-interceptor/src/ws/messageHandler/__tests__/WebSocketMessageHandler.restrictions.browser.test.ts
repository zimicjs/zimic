import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareRestrictionWebSocketMessageHandlerTests } from './shared/restrictions';

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Restrictions', ({ type, Handler }) => {
  declareRestrictionWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
