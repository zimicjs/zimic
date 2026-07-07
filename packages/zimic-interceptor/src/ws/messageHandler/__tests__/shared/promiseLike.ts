import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import RemoteWebSocketInterceptor from '../../../interceptor/RemoteWebSocketInterceptor';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor } from '../../../interceptor/types/public';
import RemoteWebSocketInterceptorWorker from '../../../interceptorWorker/RemoteWebSocketInterceptorWorker';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import type { SyncedRemoteWebSocketMessageHandler } from '../../types/public';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

function mockNextRemoteHandlerCommit(interceptor: PublicRemoteWebSocketInterceptor<Schema>, error: Error) {
  const internalInterceptor = interceptor as RemoteWebSocketInterceptor<Schema>;
  const worker = (internalInterceptor.implementation as unknown as { worker: RemoteWebSocketInterceptorWorker }).worker;

  vi.spyOn(worker.webSocketClient, 'request').mockRejectedValueOnce(error);
}

export function declarePromiseLikeWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, startServer, stopServer, getBaseURL } = options;

  let baseURL: string;

  beforeAll(async () => {
    await startServer?.();
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);
  });

  afterAll(async () => {
    await stopServer?.();
  });

  describe('Promise-like', () => {
    it('should be then-able', async () => {
      await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
        const handler = interceptor.message().respond({ type: 'delete', id: '1' });

        expectTypeOf(handler.then()).toEqualTypeOf<Promise<SyncedRemoteWebSocketMessageHandler<Schema>>>();

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

        expectTypeOf(handler.catch()).toEqualTypeOf<Promise<SyncedRemoteWebSocketMessageHandler<Schema>>>();

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

    it('should reject await if remote registration fails', async () => {
      await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
        const commitError = new Error('Commit failed.');
        mockNextRemoteHandlerCommit(interceptor, commitError);

        const handler = interceptor.message().respond({ type: 'delete', id: '1' });

        await expect(handler).rejects.toThrow(commitError);
      });
    });

    it('should reject then if remote registration fails', async () => {
      await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
        const commitError = new Error('Commit failed.');
        mockNextRemoteHandlerCommit(interceptor, commitError);

        const handler = interceptor.message().respond({ type: 'delete', id: '1' });
        const fulfillmentListener = vi.fn();
        const rejectionListener = vi.fn((error: unknown) => {
          expect(error).toBe(commitError);
          return 'recovered' as const;
        });

        await expect(handler.then(fulfillmentListener, rejectionListener)).resolves.toBe('recovered');

        expect(fulfillmentListener).not.toHaveBeenCalled();
        expect(rejectionListener).toHaveBeenCalledTimes(1);
      });
    });

    it('should recover with catch if remote registration fails', async () => {
      await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
        const commitError = new Error('Commit failed.');
        mockNextRemoteHandlerCommit(interceptor, commitError);

        const handler = interceptor.message().respond({ type: 'delete', id: '1' });
        const rejectionListener = vi.fn((error: unknown) => {
          expect(error).toBe(commitError);
          return 'recovered' as const;
        });

        await expect(handler.catch(rejectionListener)).resolves.toBe('recovered');

        expect(rejectionListener).toHaveBeenCalledTimes(1);
      });
    });

    it('should run finally if remote registration fails and allow later successful registration', async () => {
      await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
        const commitError = new Error('Commit failed.');
        mockNextRemoteHandlerCommit(interceptor, commitError);

        const failedHandler = interceptor.message().respond({ type: 'delete', id: '1' });
        const finallyListener = vi.fn();

        await expect(failedHandler.finally(finallyListener)).rejects.toThrow(commitError);

        expect(finallyListener).toHaveBeenCalledTimes(1);

        const successfulHandler = interceptor.message().respond({ type: 'delete', id: '2' });

        await expect(successfulHandler).resolves.toEqual(successfulHandler);
      });
    });

    it('should not match messages with a handler whose remote registration failed', async () => {
      await usingWebSocketInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
        const commitError = new Error('Commit failed.');
        mockNextRemoteHandlerCommit(interceptor, commitError);

        const failedEffect = vi.fn();
        const failedHandler = interceptor.message().with({ type: 'delete', id: 'failed' }).effect(failedEffect);

        await expect(failedHandler).rejects.toThrow(commitError);

        const successfulEffect = vi.fn();
        const successfulHandler = interceptor
          .message()
          .with({ type: 'delete', id: 'successful' })
          .effect(successfulEffect);

        await expect(successfulHandler).resolves.toEqual(successfulHandler);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          client.send(JSON.stringify({ type: 'delete', id: 'failed' }));

          await waitForNot(() => {
            expect(failedEffect).toHaveBeenCalled();
          });

          client.send(JSON.stringify({ type: 'delete', id: 'successful' }));

          await waitFor(() => {
            expect(successfulEffect).toHaveBeenCalledTimes(1);
          });
        } finally {
          await client.close();
        }
      });
    });
  });
}
