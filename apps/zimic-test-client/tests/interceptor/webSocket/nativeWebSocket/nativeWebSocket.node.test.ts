import { describe } from 'vitest';

import { declareNativeWebSocketClientTests } from '../shared/client';

describe('Native WebSocket client (Node.js)', () => {
  declareNativeWebSocketClientTests({ platform: 'node' });
});
