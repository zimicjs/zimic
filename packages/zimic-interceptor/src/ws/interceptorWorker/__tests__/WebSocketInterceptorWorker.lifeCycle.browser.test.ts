import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareLifeCycleWebSocketInterceptorWorkerTests } from './shared/lifeCycle';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptorWorker (browser, $type) > Life cycle', (defaultWorkerOptions) => {
  declareLifeCycleWebSocketInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
