import test from '@playwright/test';

import { interceptors } from './interceptors';

test.beforeAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.start();
  }
});

test.beforeEach(async () => {
  for (const interceptor of interceptors) {
    await interceptor.clear();
  }
});

test.afterAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.stop();
  }
});
