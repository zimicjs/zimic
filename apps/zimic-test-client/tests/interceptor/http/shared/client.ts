import { HttpInterceptorPlatform, HttpInterceptorType } from '@zimic/interceptor/http';
import { describe } from 'vitest';

import { declareHttpInterceptorTests } from './interceptor';

export interface ClientTestOptions {
  platform: HttpInterceptorPlatform;
}

export interface ClientTestOptionsByWorkerType extends ClientTestOptions {
  type: HttpInterceptorType;
}

export function declareClientTests(options: ClientTestOptions) {
  const interceptorTypes: HttpInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("HTTP interceptor (type '%s')", async (type) => {
    await declareHttpInterceptorTests({ ...options, type });
  });
}
