import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTimesWebSocketMessageHandlerTests } from './shared/times';

describe.each(testMatrix)(
  'WebSocketMessageHandler (browser, $type) > Times',
  ({ type, receivedBlobMessageRepresentation }) => {
    declareTimesWebSocketMessageHandlerTests({
      platform: 'browser',
      type,
      receivedBlobMessageRepresentation,
      getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
    });
  },
);
