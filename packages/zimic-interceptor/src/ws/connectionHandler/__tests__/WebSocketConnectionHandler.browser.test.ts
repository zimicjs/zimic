import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDefaultWebSocketConnectionHandlerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketConnectionHandler (browser, $type)', ({ type }) => {
  declareDefaultWebSocketConnectionHandlerTests({
    platform: 'browser',
    type,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
