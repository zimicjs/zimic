import { WebSocketClient } from '@zimic/ws';
import { describe } from 'vitest';

import { declareClientTests } from './shared/client';

describe('WebSocket client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    defaultBinaryMessageType: Blob,
    openSocket: async (url, protocols) => {
      const socket = new WebSocketClient(url, protocols);
      await socket.open();
      return socket;
    },
  });
});
