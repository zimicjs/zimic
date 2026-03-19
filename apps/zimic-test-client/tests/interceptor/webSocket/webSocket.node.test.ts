import { describe } from 'vitest';

import { declareClientTests } from '../http/shared/client';

describe('WebSocket client (Node.js)', () => {
  declareClientTests({ platform: 'node' });
});
