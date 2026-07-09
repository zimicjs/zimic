import { describe } from 'vitest';

import { declareNativeWebSocketClientTests } from '../shared/client';

describe('Native WebSocket client (Browser)', () => {
  declareNativeWebSocketClientTests({ platform: 'browser' });
});
