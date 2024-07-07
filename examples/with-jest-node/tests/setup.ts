import { beforeAll, afterEach, afterAll } from '@jest/globals';
import { http } from 'zimic/interceptor/http';

import githubInterceptor from './interceptors/github';

http.default.onUnhandledRequest({ log: false });

beforeAll(async () => {
  await githubInterceptor.start();
});

afterEach(() => {
  githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
