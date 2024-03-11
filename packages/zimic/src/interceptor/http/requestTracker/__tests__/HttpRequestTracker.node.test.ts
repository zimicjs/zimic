import { describe } from 'vitest';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('HttpRequestTracker (Node.js)', () => {
  declareSharedHttpRequestTrackerTests({
    platform: 'node',
  });
});
