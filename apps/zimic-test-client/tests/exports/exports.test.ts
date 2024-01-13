import { describe, expect, it } from 'vitest';
import { HttpInterceptor } from 'zimic/interceptor';

describe('Exports', () => {
  it('should export an HttpInterceptor class', () => {
    expect(typeof HttpInterceptor).toBe('function');

    const interceptor = new HttpInterceptor();
    expect(interceptor).toBeInstanceOf(HttpInterceptor);
  });
});
