import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareActionsHttpRequestHandlerTests } from './shared/actions';
import testMatrix from './shared/matrix';

describe.each(testMatrix.filter(({ type }) => type === 'local'))(
  'HttpRequestHandler actions (browser, $type)',
  ({ type, Handler }) => {
    declareActionsHttpRequestHandlerTests({
      platform: 'browser',
      type,
      Handler,
      getBaseURL: getBrowserBaseURL,
    });
  },
);
