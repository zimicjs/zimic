import '@testing-library/jest-dom/vitest';

import { beforeAll, beforeEach, afterAll } from 'vitest';

import githubInterceptor from './interceptors/githubInterceptor';
import interceptorWorker from './interceptors/worker';

beforeAll(async () => {
  await interceptorWorker.start();
});

beforeEach(() => {
  githubInterceptor.clear();
});

afterAll(async () => {
  await interceptorWorker.stop();
});
