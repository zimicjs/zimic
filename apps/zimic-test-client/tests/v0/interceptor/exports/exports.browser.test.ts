import { describe, expect, expectTypeOf, it } from 'vitest';
import { HttpInterceptorFactory } from 'zimic0/interceptor';
import { createBrowserHttpInterceptor } from 'zimic0/interceptor/browser';

describe('Exports (Browser)', () => {
  it('should export a factory to create browser HTTP interceptors', () => {
    expectTypeOf(createBrowserHttpInterceptor).toEqualTypeOf<HttpInterceptorFactory>();
    expect(typeof createBrowserHttpInterceptor).toBe('function');
  });
});
