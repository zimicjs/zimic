import { describe } from 'vitest';

import createBrowserHttpInterceptor from '../../interceptor/browser/factory';
import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('InternalHttpRequestTracker (browser)', () => {
  describe('Shared', () => {
    declareSharedHttpRequestTrackerTests(createBrowserHttpInterceptor);
  });
});
