import { afterAll, beforeAll, afterEach } from 'vitest';
import { httpInterceptor } from 'zimic/interceptor/http';

import githubInterceptor from './interceptors/github';

httpInterceptor.default.local.onUnhandledRequest = (request) => {
  const url = new URL(request.url);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (isLocalhost) {
    // Ignore requests to localhost
    return { action: 'bypass', log: false };
  }

  // Reject any other requests
  return { action: 'reject' };
};

beforeAll(async () => {
  await githubInterceptor.start();
});

afterEach(() => {
  githubInterceptor.clear();
});

afterAll(async () => {
  await githubInterceptor.stop();
});
