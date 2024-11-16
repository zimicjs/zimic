import { beforeAll, afterEach, afterAll } from '@jest/globals';
import { httpInterceptor } from 'zimic/interceptor/http';

import githubInterceptor from './interceptors/github';

httpInterceptor.default.local.onUnhandledRequest = (request) => {
  const url = new URL(request.url);

  return {
    action: 'bypass',
    logWarning: url.hostname !== '127.0.0.1',
  };
};

beforeAll(async () => {
  await githubInterceptor.start();
});

afterEach(() => {
  githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
