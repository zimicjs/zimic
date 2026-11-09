import { createSocketIOProtocol, GlobalWebSocketTransport } from '@zimic/interceptor/experimental/socket.io';
import { XHR } from 'socket.io-client';
import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { createSocketIOClientTestOptions } from './utils';

describe.each([
  { transport: 'websocket', transports: [GlobalWebSocketTransport] },
  { transport: 'polling with upgrade', transports: [XHR, GlobalWebSocketTransport] },
])('Socket.IO client (browser, $transport)', ({ transports }) => {
  declareClientTests({
    platform: 'browser',
    defaultBinaryMessageType: Blob,
    createProtocol: () => createSocketIOProtocol(),
    ...createSocketIOClientTestOptions(transports),
  });
});
