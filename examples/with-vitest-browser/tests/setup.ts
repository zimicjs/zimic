import '@testing-library/jest-dom/vitest';

import { beforeAll, beforeEach, afterAll } from 'vitest';

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
