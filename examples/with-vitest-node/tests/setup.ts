import { afterAll, beforeAll, afterEach } from 'vitest';
import { http } from 'zimic/http/interceptor';

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
