import { WebSocket as WebSocketTransport, XHR } from 'socket.io-client';
import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from '../../interceptor/__tests__/shared/matrix';
import { declareIncomingPacketsSocketIOProtocolTests } from './shared/incomingPackets';

describe.each(testMatrix)('SocketIOProtocol (browser, $type) > Incoming packets', ({ type }) => {
  declareIncomingPacketsSocketIOProtocolTests({
    type,
    getBaseURL: () => getBrowserBaseURL(type).replace(/^http/, 'ws'),
    PollingTransport: XHR,
    WebSocketTransport,
  });
});
