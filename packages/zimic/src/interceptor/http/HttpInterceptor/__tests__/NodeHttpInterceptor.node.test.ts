import { describe, expect, it } from 'vitest';

import NodeHttpInterceptorWorker from '../../HttpInterceptorWorker/NodeHttpInterceptorWorker';
import HttpInterceptor from '../HttpInterceptor';
import InternalNodeHttpInterceptor from '../InternalNodeHttpInterceptor';
import NodeHttpInterceptor from '../NodeHttpInterceptor';
import { createHttpInterceptorTests } from './interceptorTests';

describe('NodeHttpInterceptor', () => {
  const defaultBaseURL = 'http://localhost:3000';

  it('should initialize with the correct worker', () => {
    const interceptor = new InternalNodeHttpInterceptor({ baseURL: defaultBaseURL });

    expect(interceptor).toBeInstanceOf(HttpInterceptor);

    const worker = interceptor.worker();
    expect(worker).toBeInstanceOf(NodeHttpInterceptorWorker);

    const baseURL = interceptor.baseURL();
    expect(baseURL).toBe(defaultBaseURL);
  });

  createHttpInterceptorTests(NodeHttpInterceptor);
});
