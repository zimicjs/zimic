import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { openZimicWebSocket } from './utils';

describe('Zimic WebSocket client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    defaultBinaryMessageType: Blob,
    openSocket: openZimicWebSocket,
  });
});
