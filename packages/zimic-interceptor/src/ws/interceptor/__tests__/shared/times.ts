import { it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { expectPossiblePromise } from '@tests/utils/promises';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import { expectWebSocketTimesCheckError } from '../../../messageHandler/__tests__/shared/utils';
import type { WebSocketInterceptorType } from '../../types/options';

interface SharedWebSocketInterceptorTimesTestOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareTimesWebSocketInterceptorTests(options: SharedWebSocketInterceptorTimesTestOptions) {
  const { type, getBaseURL } = options;

  it('should check the times of the registered message handlers', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() }, async (interceptor) => {
      const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

      await expectWebSocketTimesCheckError(
        () => expectPossiblePromise(interceptor.checkTimes(), { shouldBePromise: type === 'remote' }),
        {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        },
      );

      await handler.times(0);

      await expectPossiblePromise(interceptor.checkTimes(), { shouldBePromise: type === 'remote' });
    });
  });

  if (type === 'remote') {
    it('should check times when called, before the returned promise is awaited', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() }, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        const timesCheckPromise = interceptor.checkTimes();
        await handler.times(0);

        await expectWebSocketTimesCheckError(() => timesCheckPromise, {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });
      });
    });
  }
}
