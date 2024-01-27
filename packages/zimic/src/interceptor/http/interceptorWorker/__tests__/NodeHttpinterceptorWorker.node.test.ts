import { describe, expect, expectTypeOf, it } from 'vitest';

import HttpInterceptorWorker from '../HttpInterceptorWorker';
import NodeHttpInterceptorWorker from '../NodeHttpInterceptorWorker';
import { NodeHttpWorker } from '../types';
import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('NodeHttpInterceptorWorker', () => {
  it('should initialize using the Node.js MSW server', () => {
    const interceptorWorker = new NodeHttpInterceptorWorker({ baseURL: '' });

    expect(interceptorWorker).toBeInstanceOf(HttpInterceptorWorker);

    const mswWorker = interceptorWorker.worker();
    expectTypeOf(mswWorker).toEqualTypeOf<NodeHttpWorker>();
  });

  describe('Shared', () => {
    declareSharedHttpInterceptorWorkerTests(NodeHttpInterceptorWorker);
  });
});
