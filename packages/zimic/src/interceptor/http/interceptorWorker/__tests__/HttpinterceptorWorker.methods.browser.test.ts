import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareMethodHttpInterceptorWorkerTests } from './shared/methods';

describe.each(testMatrix)('HttpInterceptorWorker methods (browser, $type)', (defaultWorkerOptions) => {
  declareMethodHttpInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    getBaseURL: getBrowserBaseURL,
  });
});
