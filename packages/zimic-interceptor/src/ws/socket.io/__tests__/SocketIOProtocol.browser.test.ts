import { WebSocket as WebSocketTransport, XHR } from 'socket.io-client';
import { describe, inject } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from '../../interceptor/__tests__/shared/matrix';
import { declareSocketIOProtocolTests } from './shared/default';

describe.each(testMatrix)('SocketIOProtocol (browser, $type)', ({ type }) => {
  const authenticatedServer = inject('authenticatedInterceptorServer');

  declareSocketIOProtocolTests({
    type,
    getBaseURL: () => getBrowserBaseURL(type).replace(/^http/, 'ws'),
    getAuthenticatedBaseURL: () => authenticatedServer.url.replace(/^http/, 'ws'),
    getValidToken: () => authenticatedServer.token,
    PollingTransport: XHR,
    WebSocketTransport,
  });
});
