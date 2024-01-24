import { describe, expect, it } from 'vitest';
import { createBrowserHttpInterceptor } from 'zimic0/interceptor/browser';

describe('Exports (Browser)', () => {
  it('should export a factory to create Browser HTTP interceptors', () => {
    expect(typeof createBrowserHttpInterceptor).toBe('function');
  });
});
