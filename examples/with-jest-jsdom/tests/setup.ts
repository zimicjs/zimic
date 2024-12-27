import '@testing-library/jest-dom/jest-globals';

import { beforeAll, afterEach, afterAll, beforeEach } from '@jest/globals';

import githubInterceptor from './interceptors/github';

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
