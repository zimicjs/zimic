import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareLocalWebSocketInterceptorWorkerTests } from './shared/local';

describe('WebSocketInterceptorWorker (browser, local)', () => {
  declareLocalWebSocketInterceptorWorkerTests({
    platform: 'browser',
    getBaseURL: () => getBrowserBaseURL('local').replace(/^http/, 'ws'),
  });
});
