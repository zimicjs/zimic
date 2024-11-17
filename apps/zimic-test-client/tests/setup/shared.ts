import { beforeEach } from 'vitest';
import { httpInterceptor } from 'zimic/interceptor/http';

beforeEach(() => {
  httpInterceptor.default.local.onUnhandledRequest = {
    action: 'reject',
    log: true,
  };

  httpInterceptor.default.remote.onUnhandledRequest = {
    action: 'reject',
    log: true,
  };
});
