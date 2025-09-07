import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declarePathParamsHttpInterceptorWorkerTests } from './shared/pathParams';

describe.each(testMatrix)('HttpInterceptorWorker methods (browser, $type)', (defaultWorkerOptions) => {
  declarePathParamsHttpInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    getBaseURL: getBrowserBaseURL,
  });
});
