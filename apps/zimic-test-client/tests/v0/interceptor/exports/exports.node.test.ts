import { describe, expect, expectTypeOf, it } from 'vitest';
import { HttpInterceptorFactory } from 'zimic0/interceptor';
import { createNodeHttpInterceptor } from 'zimic0/interceptor/node';

describe('Exports (Node.js)', () => {
  it('should export a factory to create Node.js HTTP interceptors', () => {
    expectTypeOf(createNodeHttpInterceptor).toEqualTypeOf<HttpInterceptorFactory>();
    expect(typeof createNodeHttpInterceptor).toBe('function');
  });
});
