import test from '@playwright/test';

import { interceptors } from './interceptors';
import { applyGitHubFixtures } from './interceptors/github/fixtures';

test.beforeAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.start();
  }
  await applyGitHubFixtures();
});

test.afterAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.stop();
  }
});
