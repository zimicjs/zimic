import { XHR } from 'socket.io-client';
import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from '../../interceptor/__tests__/shared/matrix';
import { declareSocketIOProtocolTests } from './shared/default';

describe.each(testMatrix)('SocketIOProtocol (browser, $type)', ({ type }) => {
  declareSocketIOProtocolTests({
    type,
    getBaseURL: () => getBrowserBaseURL(type).replace(/^http/, 'ws'),
    PollingTransport: XHR,
  });
});
