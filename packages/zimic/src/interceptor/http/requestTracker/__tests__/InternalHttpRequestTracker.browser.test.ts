import { describe } from 'vitest';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('HttpRequestTracker (browser)', () => {
  declareSharedHttpRequestTrackerTests({
    platform: 'browser',
  });
});
