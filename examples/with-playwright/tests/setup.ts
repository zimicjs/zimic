import test from '@playwright/test';

import { applyGitHubFixtures } from './interceptors/github/fixtures';
import githubInterceptor from './interceptors/github/interceptor';

test.beforeAll(async () => {
  await githubInterceptor.start();
  await applyGitHubFixtures();
});

test.afterAll(async () => {
  await githubInterceptor.stop();
});
