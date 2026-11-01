import { describe } from 'vitest';

import { declareSocketIOInterceptorTests } from './interceptor';

describe('socket.io client (Browser)', () => {
  declareSocketIOInterceptorTests({ platform: 'browser' });
});
