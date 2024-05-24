import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (browser)', () => {
  declareSharedHttpInterceptorWorkerTests({
    platform: 'browser',

    getBaseURL(type) {
      return getBrowserBaseURL(type);
    },
  });
});
