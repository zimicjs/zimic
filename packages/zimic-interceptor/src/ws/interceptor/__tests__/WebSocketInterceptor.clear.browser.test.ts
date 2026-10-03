import { describe } from 'vitest';

import { declareWebSocketInterceptorClearTests } from './shared/clear';

describe('WebSocketInterceptor (browser) > Clear', () => {
  declareWebSocketInterceptorClearTests();
});
