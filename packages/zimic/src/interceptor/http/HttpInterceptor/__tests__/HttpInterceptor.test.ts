import { describe, expect, it } from 'vitest';

import NodeHttpInterceptor from '../NodeHttpInterceptor';

describe('HttpInterceptor', () => {
  it('should instantiate without an error', () => {
    const interceptor = new NodeHttpInterceptor();
    expect(interceptor).toBeInstanceOf(NodeHttpInterceptor);
  });
});
