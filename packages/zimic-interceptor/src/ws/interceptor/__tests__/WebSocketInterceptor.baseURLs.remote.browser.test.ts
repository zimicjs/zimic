import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareRemoteBaseURLWebSocketInterceptorTests } from './shared/baseURLs.remote';

describe('WebSocketInterceptor (browser, remote) > Base URLs', () => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL('remote').replace(/^http/, 'ws');
  });

  declareRemoteBaseURLWebSocketInterceptorTests({
    getBaseURL: () => baseURL,
  });
});
