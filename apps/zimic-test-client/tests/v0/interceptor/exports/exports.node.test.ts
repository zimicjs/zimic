import { describe, expect, it } from 'vitest';
import { createNodeHttpInterceptor } from 'zimic0/interceptor/node';

describe('Exports (Node.js)', () => {
  it('should export a factory to create Node.js HTTP interceptors', () => {
    expect(typeof createNodeHttpInterceptor).toBe('function');
  });
});
