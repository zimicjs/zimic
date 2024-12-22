import '@testing-library/jest-dom/jest-globals';

import { beforeAll, afterEach, afterAll } from '@jest/globals';

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
