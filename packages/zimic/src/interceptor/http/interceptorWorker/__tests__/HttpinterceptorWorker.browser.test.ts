import { describe } from 'vitest';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (browser)', () => {
  declareSharedHttpInterceptorWorkerTests({
    platform: 'browser',
  });
});
