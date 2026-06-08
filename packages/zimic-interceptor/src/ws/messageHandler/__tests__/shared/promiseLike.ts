import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

export function declarePromiseLikeWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, Handler, startServer, stopServer, getBaseURL } = options;

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  if (Handler === RemoteWebSocketMessageHandler && type === 'remote') {
    describe('Promise-like', () => {
      it('should be then-able', async () => {
        await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'delete', id: '1' });

          expect(handler).toHaveProperty('then', expect.any(Function));
          expect(handler).toHaveProperty('catch', expect.any(Function));
          expect(handler).toHaveProperty('finally', expect.any(Function));

          const fulfillmentListener = vi.fn((syncedHandler) => {
            expect(syncedHandler).toEqual(handler);
            expect(syncedHandler).not.toHaveProperty('then');
            expect(syncedHandler).toHaveProperty('catch', expect.any(Function));
            expect(syncedHandler).toHaveProperty('finally', expect.any(Function));
          });

          await handler.then(fulfillmentListener);

          expect(fulfillmentListener).toHaveBeenCalledTimes(1);
        });
      });

      it('should be catch-able', async () => {
        await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'delete', id: '1' });
          const rejectionListener = vi.fn();

          await expect(handler.catch(rejectionListener)).resolves.toEqual(handler);
          expect(rejectionListener).not.toHaveBeenCalled();
        });
      });

      it('should be finally-able', async () => {
        await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'delete', id: '1' });
          const finallyListener = vi.fn();

          const syncedHandler = await handler.finally(finallyListener);

          expect(syncedHandler).toEqual(handler);
          expect(finallyListener).toHaveBeenCalledTimes(1);
        });
      });
    });
  }
}
