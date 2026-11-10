import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareRestrictionWebSocketConnectionHandlerTests } from './shared/restrictions';

describe.each(testMatrix)('WebSocketConnectionHandler (browser, $type) > Restrictions', ({ type }) => {
  declareRestrictionWebSocketConnectionHandlerTests({
    platform: 'browser',
    type,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
