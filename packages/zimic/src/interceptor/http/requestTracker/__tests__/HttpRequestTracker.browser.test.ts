import { describe } from 'vitest';

import { getBrowserAccessResources } from '@tests/utils/workers';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('HttpRequestTracker (browser)', () => {
  declareSharedHttpRequestTrackerTests({
    platform: 'browser',

    getAccessResources(type) {
      return getBrowserAccessResources(type);
    },
  });
});
