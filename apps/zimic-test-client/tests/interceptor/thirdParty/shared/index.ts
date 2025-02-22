import { HttpInterceptorPlatform, HttpInterceptorType } from '@zimic/interceptor/http';
import { describe } from 'vitest';

import declareDefaultClientTests from './default';

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

  describe.each(interceptorTypes)("Default (type '%s')", async (type) => {
    await declareDefaultClientTests({ ...options, type });
  });
}

export default declareClientTests;
