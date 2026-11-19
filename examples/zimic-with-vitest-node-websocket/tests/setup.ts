import { afterAll, beforeAll, afterEach, beforeEach } from 'vitest';

import chatInterceptor from './interceptors/chat';

beforeAll(async () => {
  await chatInterceptor.start();
});

beforeEach(() => {
  chatInterceptor.clear();
});

afterEach(() => {
  chatInterceptor.checkTimes();
});

afterAll(async () => {
  await chatInterceptor.stop();
});
