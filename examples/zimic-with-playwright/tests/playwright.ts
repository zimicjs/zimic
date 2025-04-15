import { test as base } from '@playwright/test';

import { afterAll, afterEach, beforeAll, beforeEach } from './setup';

export const test = base.extend<{ testFixture: string }, { workerFixture: string }>({
  workerFixture: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await beforeAll();
      await use('workerFixture');
      await afterAll();
    },
    { scope: 'worker', auto: true },
  ],

  testFixture: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await beforeEach();
      await use('testFixture');
      await afterEach();
    },
    { scope: 'test', auto: true },
  ],
});
