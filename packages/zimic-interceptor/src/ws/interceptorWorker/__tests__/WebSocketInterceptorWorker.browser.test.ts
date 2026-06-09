import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDefaultWebSocketInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptorWorker (browser, $type)', (defaultWorkerOptions) => {
  declareDefaultWebSocketInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
