import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { createNativeWebSocket, openNativeWebSocket } from './utils';

describe('Native WebSocket client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    defaultBinaryMessageType: Blob,
    openSocket: openNativeWebSocket,
    createSocket: createNativeWebSocket,
  });
});
