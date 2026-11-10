import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { createZimicWebSocket, openZimicWebSocket } from './utils';

describe('Zimic WebSocket client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    defaultBinaryMessageType: Blob,
    openSocket: openZimicWebSocket,
    createSocket: createZimicWebSocket,
  });
});
