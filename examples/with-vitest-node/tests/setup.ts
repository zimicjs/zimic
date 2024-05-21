import { afterAll, beforeAll, beforeEach } from 'vitest';
import { http } from 'zimic/interceptor';

import githubInterceptor from './interceptors/github';

http.default.onUnhandledRequest({ log: false });

beforeAll(async () => {
  await githubInterceptor.start();
});

beforeEach(() => {
  githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
