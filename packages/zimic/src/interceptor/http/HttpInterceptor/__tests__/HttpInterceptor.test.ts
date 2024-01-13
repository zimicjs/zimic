import { describe, expect, it } from 'vitest';

import HttpInterceptor from '../HttpInterceptor';

describe('HttpInterceptor', () => {
  it('should instantiate without an error', () => {
    const interceptor = new HttpInterceptor();
    expect(interceptor).toBeInstanceOf(HttpInterceptor);
  });
});
