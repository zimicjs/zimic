import { afterAll, beforeAll, afterEach, beforeEach } from 'vitest';

import githubInterceptor from './interceptors/github/interceptor';

beforeAll(async () => {
  await githubInterceptor.start();
});

beforeEach(() => {
  githubInterceptor.clear();
});

afterEach(() => {
  githubInterceptor.checkTimes();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
