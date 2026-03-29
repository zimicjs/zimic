import { describe } from 'vitest';

import { declareClientTests } from './shared/client';

describe('WebSocket client (Browser)', () => {
  declareClientTests({ platform: 'browser' });
});
