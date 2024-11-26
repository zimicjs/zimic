import { beforeEach } from 'vitest';

import { httpInterceptor } from '@/interceptor/http';

beforeEach(() => {
  httpInterceptor.default.local.onUnhandledRequest = {
    action: 'bypass',
    log: false,
  };

  httpInterceptor.default.remote.onUnhandledRequest = {
    action: 'reject',
    log: false,
  };
});
