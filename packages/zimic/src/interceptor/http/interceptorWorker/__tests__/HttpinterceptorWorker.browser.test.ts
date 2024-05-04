import { describe } from 'vitest';

import { getBrowserAccessResources } from '@tests/utils/workers';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (browser)', () => {
  declareSharedHttpInterceptorWorkerTests({
    platform: 'browser',

    getAccessResources(type) {
      return getBrowserAccessResources(type);
    },
  });
});
