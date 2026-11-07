import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTimesWebSocketConnectionHandlerTests } from './shared/times';

describe.each(testMatrix)('WebSocketConnectionHandler (browser, $type) > Times', ({ type }) => {
  declareTimesWebSocketConnectionHandlerTests({
    platform: 'browser',
    type,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
