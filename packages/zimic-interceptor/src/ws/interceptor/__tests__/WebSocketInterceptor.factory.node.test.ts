import { describe, expect, it } from 'vitest';

import UnknownWebSocketInterceptorTypeError from '../errors/UnknownWebSocketInterceptorTypeError';
import { createWebSocketInterceptor } from '../factory';

describe('WebSocket interceptor factory', () => {
  it('should reject an unsupported interceptor type', () => {
    expect(() => createWebSocketInterceptor({ type: 'unsupported' } as never)).toThrow(
      new UnknownWebSocketInterceptorTypeError('unsupported'),
    );
  });
});
