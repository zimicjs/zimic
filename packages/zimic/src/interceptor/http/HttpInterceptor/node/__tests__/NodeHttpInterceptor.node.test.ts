import { describe, expect, expectTypeOf, it } from 'vitest';

import NodeHttpInterceptorWorker from '@/interceptor/http/HttpInterceptorWorker/NodeHttpInterceptorWorker';

import { createHttpInterceptorTests } from '../../__tests__/interceptorTests';
import HttpInterceptor from '../../HttpInterceptor';
import createNodeHttpInterceptor from '../factory';
import InternalNodeHttpInterceptor from '../InternalNodeHttpInterceptor';
import NodeHttpInterceptor from '../NodeHttpInterceptor';

describe('NodeHttpInterceptor', () => {
  const defaultBaseURL = 'http://localhost:3000';

  it('should initialize with the correct worker', () => {
    const interceptor = new InternalNodeHttpInterceptor({ baseURL: defaultBaseURL });
    expect(interceptor).toBeInstanceOf(NodeHttpInterceptor);
    expect(interceptor).toBeInstanceOf(HttpInterceptor);

    const worker = interceptor.worker();
    expect(worker).toBeInstanceOf(NodeHttpInterceptorWorker);

    const baseURL = interceptor.baseURL();
    expect(baseURL).toBe(defaultBaseURL);
  });

  createHttpInterceptorTests(InternalNodeHttpInterceptor);

  describe('Factory', () => {
    it('should create an InternalNodeHttpInterceptor typed as a generic HttpInterceptor', () => {
      const interceptor = createNodeHttpInterceptor<{}>({ baseURL: defaultBaseURL });

      expect(interceptor).toBeInstanceOf(InternalNodeHttpInterceptor);
      expectTypeOf(interceptor).toEqualTypeOf<HttpInterceptor<{}>>();
    });
  });
});
