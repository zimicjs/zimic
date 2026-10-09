import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareTimesWebSocketInterceptorTests } from './shared/times';

describe('WebSocketInterceptor (browser, remote) > Times', () => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL('remote').replace(/^http/, 'ws');
  });

  declareTimesWebSocketInterceptorTests({
    getBaseURL: () => baseURL,
  });
});
