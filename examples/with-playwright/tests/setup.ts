import test from '@playwright/test';

import { loadInterceptors, stopInterceptors } from './interceptors';

test.beforeAll(async () => {
  await loadInterceptors();
});

test.afterAll(async () => {
  await stopInterceptors();
});
