import { describe } from 'vitest';

import { declareSocketIOInterceptorTests } from './interceptor';

describe('socket.io client (Node.js)', () => {
  declareSocketIOInterceptorTests({ platform: 'node' });
});
