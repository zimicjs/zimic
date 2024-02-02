import { describe } from 'vitest';

import { declareSharedHttpInterceptorTests } from './shared/interceptorTests';

describe('HttpInterceptor (Node.js)', () => {
  declareSharedHttpInterceptorTests({
    platform: 'node',
  });
});
