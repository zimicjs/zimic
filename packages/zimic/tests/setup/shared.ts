import { beforeEach } from 'vitest';

import { httpInterceptor } from '@/interceptor/http';

beforeEach(() => {
  httpInterceptor.default.local.onUnhandledRequest = {
    action: 'bypass',
    logWarning: false,
  };

  httpInterceptor.default.remote.onUnhandledRequest = {
    action: 'reject',
    logWarning: false,
  };
});
