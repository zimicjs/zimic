import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareRemoteBaseURLHttpInterceptorTests } from './shared/baseURLs.remote';

describe('HttpInterceptor (browser, remote) > Base URLs', () => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL('remote');
  });

  declareRemoteBaseURLHttpInterceptorTests({
    getBaseURL: () => baseURL,
  });
});
