import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { openNativeWebSocket } from './utils';

describe('Native WebSocket client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    defaultBinaryMessageType: Blob,
    openSocket: openNativeWebSocket,
  });
});
