import { HttpInterceptorPlatform, HttpInterceptorType } from '@zimic/interceptor/http';
import { describe } from 'vitest';

import declareHttpInterceptorTests from './httpInterceptor';

export const ZIMIC_SERVER_PORT = 4000;

export interface ClientTestOptions {
  platform: HttpInterceptorPlatform;
  fetch: (request: Request) => Promise<Response>;
}

export interface ClientTestOptionsByWorkerType extends ClientTestOptions {
  type: HttpInterceptorType;
}

function declareClientTests(options: ClientTestOptions) {
  const interceptorTypes: HttpInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("HTTP interceptor (type '%s')", async (type) => {
    await declareHttpInterceptorTests({ ...options, type });
  });
}

export default declareClientTests;
