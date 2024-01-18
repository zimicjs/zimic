import { describe, expect, expectTypeOf, it } from 'vitest';

import HttpInterceptorWorker from '../HttpInterceptorWorker';
import NodeHttpInterceptorWorker from '../NodeHttpInterceptorWorker';
import { NodeMSWWorker } from '../types';
import { createHttpInterceptorWorkerTests } from './workerTests';

describe('NodeHttpInterceptorWorker', () => {
  it('should initialize using the Node.js MSW server', () => {
    const interceptorWorker = new NodeHttpInterceptorWorker({ baseURL: '' });

    expect(interceptorWorker).toBeInstanceOf(HttpInterceptorWorker);

    const mswWorker = interceptorWorker.worker();
    expectTypeOf(mswWorker).toEqualTypeOf<NodeMSWWorker>();
  });

  describe('Shared', () => {
    createHttpInterceptorWorkerTests(NodeHttpInterceptorWorker);
  });
});
