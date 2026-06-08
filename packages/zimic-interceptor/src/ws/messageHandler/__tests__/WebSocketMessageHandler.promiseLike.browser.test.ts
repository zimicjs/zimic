import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declarePromiseLikeWebSocketMessageHandlerTests } from './shared/promiseLike';

describe.each(testMatrix.filter(({ type }) => type === 'remote'))(
  'WebSocketMessageHandler (browser, $type) > Promise-like',
  ({ type, Handler }) => {
    declarePromiseLikeWebSocketMessageHandlerTests({
      platform: 'browser',
      type,
      Handler,
      getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
    });
  },
);
