import { describe } from 'vitest';

import { declareClientTests } from '../http/shared/client';

describe('WebSocket client (Browser)', () => {
  declareClientTests({ platform: 'browser' });
});
