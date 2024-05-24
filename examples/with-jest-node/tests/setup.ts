import { beforeAll, beforeEach, afterAll } from '@jest/globals';

import githubInterceptor from './interceptors/github';

beforeAll(async () => {
  await githubInterceptor.start();
});

beforeEach(() => {
  githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
