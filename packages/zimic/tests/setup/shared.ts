import { beforeEach } from 'vitest';

import { http } from '@/interceptor';

beforeEach(() => {
  http.default.onUnhandledRequest({ log: false });
});
