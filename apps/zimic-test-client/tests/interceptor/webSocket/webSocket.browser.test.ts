import { WebSocketClient } from '@zimic/ws';
import { describe } from 'vitest';

import { declareClientTests } from './shared/client';

describe('WebSocket client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    defaultBinaryMessageType: Blob,
    openSocket: async (url, protocols) => {
      const socket = new WebSocketClient(url, protocols);
      await socket.open();
      return socket;
    },
  });
});
