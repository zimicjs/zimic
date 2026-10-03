import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareWebSocketInterceptorLifecycleTests } from './shared/lifecycle';

describe('WebSocketInterceptor (browser) > Lifecycle', () => {
  declareWebSocketInterceptorLifecycleTests({
    platform: 'browser',
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
