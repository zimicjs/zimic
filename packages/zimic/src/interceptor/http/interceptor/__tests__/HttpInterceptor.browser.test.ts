import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpInterceptorTests } from './shared';

describe('HttpInterceptor (browser)', () => {
  declareSharedHttpInterceptorTests({
    platform: 'browser',

    getBaseURL(type) {
      return getBrowserBaseURL(type);
    },
  });
});
