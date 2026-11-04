import { createPromiseWithResolvers } from '@zimic/utils/data';
import { WebSocketClient } from '@zimic/ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { openWebSocketUntilSettled, usingWebSocketClient } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import RemoteWebSocketConnectionHandler from '../../RemoteWebSocketConnectionHandler';
import { WebSocketConnectionHandler } from '../../types/public';
import { Schema, SharedWebSocketConnectionHandlerTestOptions } from './utils';

export function declareDefaultWebSocketConnectionHandlerTests(
  options: SharedWebSocketConnectionHandlerTestOptions & {
    type: WebSocketInterceptorType;
  },
) {
  const { type, startServer, stopServer, getBaseURL } = options;

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

  // No WebSocket counterpart for "should provide access to the method and path": connection handlers have no method,
  // and their path is matched by the worker, not exposed.

  // Unlike HTTP requests, a connection needs no declared response, so a handler without one still matches and accepts.
  it('should match any connection if contains no declared response', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.connection().times(1);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          expect(client.readyState).toBe(WebSocketClient.OPEN);
          expect(handler.connections).toHaveLength(1);

          await handler.checkTimes();
        });
      },
    );
  });

  it('should match any connection if contains a declared response and no restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const handler = await interceptor.connection().respond({ action: 'reject' });

      let attempt = await openWebSocketUntilSettled(baseURL);
      expect(attempt.eventTypes).toEqual(['error', 'close']);

      await handler.with({});

      attempt = await openWebSocketUntilSettled(baseURL);
      expect(attempt.eventTypes).toEqual(['error', 'close']);
    });
  });

  it('should not match any connection if cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        await interceptor.connection().respond({ action: 'reject' });
        const handler = await interceptor.connection().effect(vi.fn());

        await usingWebSocketClient<Schema>(baseURL, (client) => {
          expect(client.readyState).toBe(WebSocketClient.OPEN);
        });

        await handler.clear();

        const attempt = await openWebSocketUntilSettled(baseURL);
        expect(attempt.eventTypes).toEqual(['error', 'close']);
        expect(handler.connections).toHaveLength(0);

        await handler.effect(vi.fn());

        await usingWebSocketClient<Schema>(baseURL, (client) => {
          expect(client.readyState).toBe(WebSocketClient.OPEN);
        });
        expect(handler.connections).toHaveLength(1);
      },
    );
  });

  it('should not match connections if cleared while they are being matched', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        await interceptor.connection().respond({ action: 'reject' });

        const handler = await interceptor.connection().with(async () => {
          restrictionStartedPromise.resolve();
          await restrictionReleasedPromise;
          return true;
        });

        const attemptPromise = openWebSocketUntilSettled(baseURL);
        await restrictionStartedPromise;

        await handler.clear();
        restrictionReleasedPromise.resolve();

        const attempt = await attemptPromise;
        expect(attempt.eventTypes).toEqual(['error', 'close']);
        expect(handler.connections).toHaveLength(0);
      },
    );
  });

  it.each<{
    declaration: string;
    declare: (handler: WebSocketConnectionHandler<Schema>) => unknown;
  }>([
    { declaration: 'with', declare: (handler) => handler.with({}) },
    { declaration: 'respond', declare: (handler) => handler.respond({ action: 'reject' }) },
    { declaration: 'effect', declare: (handler) => handler.effect(vi.fn()) },
    { declaration: 'delay', declare: (handler) => handler.delay(0) },
    { declaration: 'times', declare: (handler) => handler.times(1) },
  ])('should match connections again if cleared and declared with $declaration', async ({ declare }) => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const olderHandler = await interceptor.connection().effect(vi.fn());
        const handler = await interceptor.connection().effect(vi.fn());

        await declare(handler.clear());

        const { socket } = await openWebSocketUntilSettled(baseURL);

        try {
          expect(handler.connections).toHaveLength(1);
          expect(olderHandler.connections).toHaveLength(0);
        } finally {
          socket.close();
        }
      },
    );
  });

  // No WebSocket counterparts for creating responses from static or computed declarations, or without a declared
  // response: connection handlers answer handshakes through the interceptor, so the interceptor suites cover them.

  it.each([
    { response: 'accepted', declare: (handler: WebSocketConnectionHandler<Schema>) => handler.effect(vi.fn()) },
    {
      response: 'rejected',
      declare: (handler: WebSocketConnectionHandler<Schema>) => handler.respond({ action: 'reject' }),
    },
  ])('should keep track of the intercepted connections ($response)', async ({ declare }) => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await declare(interceptor.connection());

        expect(handler.connections).toEqual([]);

        const { socket } = await openWebSocketUntilSettled(`${baseURL}?room=1`, ['chat', 'json']);

        try {
          expect(handler.connections).toHaveLength(1);
          expect(handler.connections[0]).toEqual({ url: socket.url, protocols: ['chat', 'json'] });
        } finally {
          socket.close();
        }
      },
    );
  });

  it('should clear the intercepted connections after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.connection().respond({ action: 'reject' });

        await openWebSocketUntilSettled(baseURL);

        const handlerConnections = handler.connections;
        expect(handlerConnections).toHaveLength(1);

        await handler.clear();

        expect(handler.connections).toBe(handlerConnections);
        expect(handler.connections).toHaveLength(0);
      },
    );
  });

  // No WebSocket counterparts for accessing raw intercepted requests and responses or their hidden properties:
  // intercepted connections carry only their URL and subprotocols.

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const handler = await interceptor
        .connection()
        .with({ protocols: ['chat'] })
        .respond({ action: 'reject' });

      await usingWebSocketClient<Schema>(baseURL, (client) => {
        expect(client.readyState).toBe(WebSocketClient.OPEN);
      });

      await handler.clear().respond({ action: 'reject' });

      const attempt = await openWebSocketUntilSettled(baseURL);
      expect(attempt.eventTypes).toEqual(['error', 'close']);
      expect(attempt.closeEvent?.code).toBe(WEB_SOCKET_CLOSE_CODES.ABNORMAL_CLOSURE);
    });
  });

  if (type === 'remote') {
    describe('Promise-like', () => {
      let interceptor: ReturnType<typeof createInternalWebSocketInterceptor<Schema>>;

      beforeEach(async () => {
        interceptor = createInternalWebSocketInterceptor<Schema>({ type, baseURL });
        await interceptor.start();
      });

      afterEach(async () => {
        await interceptor.stop();
      });

      it('should be then-able', async () => {
        const handler = new RemoteWebSocketConnectionHandler<Schema>(interceptor.implementation, undefined);
        await handler.respond({ action: 'reject' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const fulfillmentListener = vi.fn((syncedHandler: unknown) => {
          expect(syncedHandler).toEqual(handler);

          expect(syncedHandler).not.toHaveProperty('then');
          expect(syncedHandler).toHaveProperty('catch', expect.any(Function));
          expect(syncedHandler).toHaveProperty('finally', expect.any(Function));
        });

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        await pendingHandler.then(fulfillmentListener);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should be catch-able', async () => {
        const handler = new RemoteWebSocketConnectionHandler<Schema>(interceptor.implementation, undefined);
        await handler.respond({ action: 'reject' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const rejectionListener = vi.fn<(error: unknown) => void>();

        const syncedHandler = await handler.with({}).catch(rejectionListener);

        expect(syncedHandler).toEqual(handler);
        expect(syncedHandler).not.toHaveProperty('then');
        expect(rejectionListener).not.toHaveBeenCalled();
      });

      it('should be finally-able', async () => {
        const handler = new RemoteWebSocketConnectionHandler<Schema>(interceptor.implementation, undefined);
        await handler.respond({ action: 'reject' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const finallyListener = vi.fn();

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        const syncedHandler = await pendingHandler.finally(finallyListener);

        expect(syncedHandler).toEqual(handler);
        expect(syncedHandler).not.toHaveProperty('then');
        expect(finallyListener).toHaveBeenCalledTimes(1);
      });
    });
  }
}
