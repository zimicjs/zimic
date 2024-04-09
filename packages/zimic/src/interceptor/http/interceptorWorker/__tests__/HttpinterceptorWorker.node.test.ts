import { describe } from 'vitest';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', () => {
  declareSharedHttpInterceptorWorkerTests({ platform: 'node' });
});
