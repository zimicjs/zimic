import { describe } from 'vitest';
import { HttpInterceptorWorkerOptions, HttpInterceptorWorkerPlatform } from 'zimic0/interceptor';

import environment from '@tests/config/environment';

import declareDefaultClientTests from './default';

export interface ClientTestOptions {
  platform: HttpInterceptorWorkerPlatform;
  fetch: (request: Request) => Promise<Response>;
}

export interface ClientTestOptionsByWorkerType extends ClientTestOptions {
  workerOptions: HttpInterceptorWorkerOptions;
}

function declareClientTests(options: ClientTestOptions) {
  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    {
      type: 'remote',
      mockServerURL: `http://localhost:${environment.ZIMIC_SERVER_PORT}`,
    },
  ];

  describe.each(workerOptionsArray)('Default (type $type)', (workerOptions) => {
    declareDefaultClientTests({ ...options, workerOptions });
  });
}

export default declareClientTests;
