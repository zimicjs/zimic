import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDefaultHttpInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptorWorker (browser, $type)', (defaultWorkerOptions) => {
  declareDefaultHttpInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    getBaseURL: getBrowserBaseURL,
  });
});
