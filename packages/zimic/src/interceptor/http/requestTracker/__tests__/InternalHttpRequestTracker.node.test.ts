import { describe } from 'vitest';

import createNodeHttpInterceptor from '../../interceptor/node/factory';
import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('InternalHttpRequestTracker (Node.js)', () => {
  describe('Shared', () => {
    declareSharedHttpRequestTrackerTests(createNodeHttpInterceptor);
  });
});
