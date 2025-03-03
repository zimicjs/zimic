import { beforeEach } from 'vitest';

import { httpInterceptor } from '@/http';

beforeEach(() => {
  httpInterceptor.default.local.onUnhandledRequest = {
    action: 'reject',
    log: false,
  };

  httpInterceptor.default.remote.onUnhandledRequest = {
    action: 'reject',
    log: false,
  };
});
