import { describe } from 'vitest';

import { declareDefaultHttpInterceptorWorkerTests } from './default';
import { declareMethodHttpInterceptorWorkerTests } from './methods';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareSharedHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  describe('Default', () => {
    declareDefaultHttpInterceptorWorkerTests(options);
  });

  describe('Methods', () => {
    declareMethodHttpInterceptorWorkerTests(options);
  });
}
