import { describe } from 'vitest';

import { declareClientTests } from './shared/client';

describe('WebSocket client (Node.js)', () => {
  declareClientTests({ platform: 'node' });
});
