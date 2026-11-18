import { WebSocket as WebSocketTransport, XHR } from 'socket.io-client';
import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from '../../interceptor/__tests__/shared/matrix';
import { declareNamespacesSocketIOProtocolTests } from './shared/namespaces';

describe.each(testMatrix)('SocketIOProtocol (browser, $type) > Namespaces', ({ type }) => {
  declareNamespacesSocketIOProtocolTests({
    type,
    getBaseURL: () => getBrowserBaseURL(type).replace(/^http/, 'ws'),
    PollingTransport: XHR,
    WebSocketTransport,
  });
});
