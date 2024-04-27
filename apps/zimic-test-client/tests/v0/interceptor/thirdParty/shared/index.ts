import { describe } from 'vitest';
import { HttpInterceptorWorkerOptions, HttpInterceptorWorkerPlatform } from 'zimic0/interceptor';

import declareDefaultClientTests from './default';

const ZIMIC_SERVER_PORT = 4000;

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
    { type: 'remote', serverURL: `http://localhost:${ZIMIC_SERVER_PORT}` },
  ];

  describe.each(workerOptionsArray)('Default (type $type)', async (workerOptions) => {
    await declareDefaultClientTests({ ...options, workerOptions });
  });
}

export default declareClientTests;
