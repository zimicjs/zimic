import { describe } from 'vitest';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('InternalHttpRequestTracker (browser)', () => {
  declareSharedHttpRequestTrackerTests({
    platform: 'browser',
  });
});
