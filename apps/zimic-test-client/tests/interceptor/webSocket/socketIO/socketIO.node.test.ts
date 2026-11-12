import { createSocketIOProtocol, GlobalWebSocketTransport } from '@zimic/interceptor/experimental/socket.io';
import { NodeXHR } from 'socket.io-client';
import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { createSocketIOClientTestOptions } from './utils';

describe.each([
  { transport: 'websocket', transports: [GlobalWebSocketTransport] },
  { transport: 'polling with upgrade', transports: [NodeXHR, GlobalWebSocketTransport] },
])('Socket.IO client (Node.js, $transport)', ({ transports }) => {
  declareClientTests({
    platform: 'node',
    defaultBinaryMessageType: Blob,
    createProtocol: () => createSocketIOProtocol(),
    ...createSocketIOClientTestOptions(transports),
  });
});
