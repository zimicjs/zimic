import { beforeEach } from 'vitest';

import { http } from '@/interceptor/http';

beforeEach(() => {
  http.default.onUnhandledRequest({ log: false });
});
