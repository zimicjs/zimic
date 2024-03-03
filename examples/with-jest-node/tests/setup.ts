import { beforeAll, beforeEach, afterAll } from '@jest/globals';

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
