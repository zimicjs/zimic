import { HttpInterceptorPlatform, HttpInterceptorType } from '@zimic/interceptor/http';
import { describe } from 'vitest';

import { declareWebSocketInterceptorTests } from './interceptor';

export interface ClientTestOptions {
  platform: HttpInterceptorPlatform;
  fetch: (request: Request) => Promise<Response>;
}

export interface ClientTestOptionsByWorkerType extends ClientTestOptions {
  type: HttpInterceptorType;
}

export function declareClientTests(options: ClientTestOptions) {
  const interceptorTypes: HttpInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("WebSocket interceptor (type '%s')", async (type) => {
    await declareWebSocketInterceptorTests({ ...options, type });
  });
}
