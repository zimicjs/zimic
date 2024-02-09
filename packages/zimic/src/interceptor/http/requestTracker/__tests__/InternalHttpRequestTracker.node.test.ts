import { describe } from 'vitest';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('InternalHttpRequestTracker (Node.js)', () => {
  declareSharedHttpRequestTrackerTests({
    platform: 'node',
  });
});
