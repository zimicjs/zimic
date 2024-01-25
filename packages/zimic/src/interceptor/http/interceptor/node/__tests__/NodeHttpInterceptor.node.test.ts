import { describe, expect, expectTypeOf, it } from 'vitest';

import NodeHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/NodeHttpInterceptorWorker';

import { declareSharedHttpInterceptorTests } from '../../__tests__/sharedTests';
import BaseHttpInterceptor from '../../BaseHttpInterceptor';
import { HttpInterceptor } from '../../types/public';
import createNodeHttpInterceptor from '../factory';
import InternalNodeHttpInterceptor from '../InternalNodeHttpInterceptor';
import NodeHttpInterceptor from '../NodeHttpInterceptor';

describe('NodeHttpInterceptor', () => {
  const defaultBaseURL = 'http://localhost:3000';

  it('should initialize with the correct worker', () => {
    const interceptor = createNodeHttpInterceptor<{}>({ baseURL: defaultBaseURL });

    expect(interceptor).toBeInstanceOf(InternalNodeHttpInterceptor);
    expect(interceptor).toBeInstanceOf(NodeHttpInterceptor);
    expect(interceptor).toBeInstanceOf(BaseHttpInterceptor);

    expectTypeOf(interceptor).toEqualTypeOf<HttpInterceptor<{}>>();

    const internalInterceptor = interceptor as InternalNodeHttpInterceptor<{}>;
    const worker = internalInterceptor.worker();
    expect(worker).toBeInstanceOf(NodeHttpInterceptorWorker);

    const baseURL = interceptor.baseURL();
    expect(baseURL).toBe(defaultBaseURL);
  });

  declareSharedHttpInterceptorTests(createNodeHttpInterceptor);
});
