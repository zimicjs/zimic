import { beforeEach } from 'vitest';

import { httpInterceptor } from '@/interceptor/http';

beforeEach(() => {
  httpInterceptor.default.onUnhandledRequest = {
    action: 'bypass',
    log: false,
  };
});
