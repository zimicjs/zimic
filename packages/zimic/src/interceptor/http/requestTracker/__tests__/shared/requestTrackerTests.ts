import { describe } from 'vitest';

import { HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';

import LocalHttpRequestTracker from '../../LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '../../RemoteHttpRequestTracker';
import { declareDefaultHttpRequestTrackerTests } from './default';
import { declareRestrictionHttpRequestTrackerTests } from './restrictions';
import { SharedHttpRequestTrackerTestOptions } from './types';

export function declareSharedHttpRequestTrackerTests(options: SharedHttpRequestTrackerTestOptions) {
  const optionsArray: [
    { type: HttpInterceptorType; Tracker: typeof LocalHttpRequestTracker },
    { type: HttpInterceptorType; Tracker: typeof RemoteHttpRequestTracker },
  ] = [
    { type: 'local', Tracker: LocalHttpRequestTracker },
    { type: 'remote', Tracker: RemoteHttpRequestTracker },
  ];

  describe.each(optionsArray)('Shared (type $workerOptions.type)', ({ type, Tracker }) => {
    describe('Default', () => {
      declareDefaultHttpRequestTrackerTests({ ...options, type, Tracker });
    });

    describe('Restrictions', () => {
      declareRestrictionHttpRequestTrackerTests({ ...options, type, Tracker });
    });
  });
}
