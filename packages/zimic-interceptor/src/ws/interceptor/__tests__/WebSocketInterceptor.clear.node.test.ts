import { describe } from 'vitest';

import testMatrix from '../../messageHandler/__tests__/shared/matrix';
import { declareClearWebSocketInterceptorTests } from './shared/clear';

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Clear', ({ type, Handler }) => {
  declareClearWebSocketInterceptorTests({
    type,
    Handler,
  });
});
