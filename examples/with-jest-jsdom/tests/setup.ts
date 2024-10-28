import '@testing-library/jest-dom/jest-globals';

import { beforeAll, afterEach, afterAll } from '@jest/globals';
import { httpInterceptor } from 'zimic/interceptor/http';

import githubInterceptor from './interceptors/github';

httpInterceptor.default.onUnhandledRequest(async (request, context) => {
  const url = new URL(request.url);

  if (url.hostname !== '127.0.0.1') {
    await context.log();
  }
});

beforeAll(async () => {
  await githubInterceptor.start();
});

afterEach(() => {
  githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
