import { describe } from 'vitest';

import { getBrowserAccessResources } from '@tests/utils/workers';

import { declareSharedHttpInterceptorTests } from './shared/interceptorTests';

describe('HttpInterceptor (browser)', () => {
  declareSharedHttpInterceptorTests({
    platform: 'browser',

    getAccessResources(type) {
      return getBrowserAccessResources(type);
    },
  });
});
