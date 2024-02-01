import { describe } from 'vitest';

import { declareSharedHttpInterceptorTests } from './shared/interceptorTests';

describe('HttpInterceptor (browser)', () => {
  declareSharedHttpInterceptorTests({
    platform: 'browser',
  });
});
