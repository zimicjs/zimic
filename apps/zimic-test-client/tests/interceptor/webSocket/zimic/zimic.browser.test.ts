import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { openZimicWebSocket } from './utils';

describe('Zimic WebSocket client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    defaultBinaryMessageType: Blob,
    openSocket: openZimicWebSocket,
  });
});
