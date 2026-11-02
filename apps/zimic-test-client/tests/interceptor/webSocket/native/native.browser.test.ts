import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { openNativeWebSocket } from './utils';

describe('Native WebSocket client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    defaultBinaryMessageType: Blob,
    openSocket: openNativeWebSocket,
  });
});
