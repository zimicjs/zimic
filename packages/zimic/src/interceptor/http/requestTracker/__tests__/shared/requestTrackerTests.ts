import { describe } from 'vitest';

import {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '@/interceptor/http/interceptorWorker/types/options';

import LocalHttpRequestTracker from '../../LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '../../RemoteHttpRequestTracker';
import { declareDefaultHttpRequestTrackerTests } from './default';
import { declareRestrictionHttpRequestTrackerTests } from './restrictions';
import { SharedHttpRequestTrackerTestOptions } from './types';

export function declareSharedHttpRequestTrackerTests(options: SharedHttpRequestTrackerTestOptions) {
  const optionsArray: [
    { Tracker: typeof LocalHttpRequestTracker; workerOptions: LocalHttpInterceptorWorkerOptions },
    { Tracker: typeof RemoteHttpRequestTracker; workerOptions: RemoteHttpInterceptorWorkerOptions },
  ] = [
    {
      Tracker: LocalHttpRequestTracker,
      workerOptions: { type: 'local' },
    },
    {
      Tracker: RemoteHttpRequestTracker,
      workerOptions: { type: 'remote', serverURL: '<temporary>' },
    },
  ];

  describe.each(optionsArray)('Shared (type $workerOptions.type)', ({ Tracker, workerOptions }) => {
    describe('Default', () => {
      declareDefaultHttpRequestTrackerTests({ ...options, Tracker, workerOptions });
    });

    describe('Restrictions', () => {
      declareRestrictionHttpRequestTrackerTests({ ...options, Tracker, workerOptions });
    });
  });
}
