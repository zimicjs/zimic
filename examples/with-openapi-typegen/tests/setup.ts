import { afterAll, beforeAll, afterEach } from 'vitest';

import githubInterceptor from './interceptors/github';

beforeAll(async () => {
  await githubInterceptor.start();
});

afterEach(() => {
  githubInterceptor.checkTimes();
  githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
