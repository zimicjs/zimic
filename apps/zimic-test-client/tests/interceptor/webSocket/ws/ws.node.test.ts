import { describe } from 'vitest';
import NodeWebSocket from 'ws';

import { declareWebSocketInterceptorTests } from '../shared/interceptor';

// Remote-only: local interceptors only intercept sockets created through `globalThis.WebSocket`, not sockets created
// directly with the `ws` package.
describe("ws client (Node.js, type 'remote')", () => {
  declareWebSocketInterceptorTests({
    platform: 'node',
    type: 'remote',
    defaultBinaryMessageType: Buffer,
    openSocket: async (url, protocols) => {
      const socket = new NodeWebSocket(url, protocols);

      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
      });

      return socket;
    },
    createSocket: (url, protocols) => new NodeWebSocket(url, protocols),
  });
});
