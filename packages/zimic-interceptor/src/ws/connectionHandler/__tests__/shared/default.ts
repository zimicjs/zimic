import { createPromiseWithResolvers } from '@zimic/utils/data';
import { HttpSearchParams } from '@zimic/utils/http';
import { joinURL } from '@zimic/utils/url';
import { WebSocketClient } from '@zimic/ws';
import color from 'picocolors';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  expectWebSocketTimesCheckError,
  openWebSocketUntilSettled,
  usingWebSocketClient,
} from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import RemoteWebSocketConnectionHandler from '../../RemoteWebSocketConnectionHandler';
import { WebSocketConnectionHandler, WebSocketConnectionHandlerResponseComputedDeclaration } from '../../types/public';
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

  // Unlike HTTP requests, WebSocket connections have no method, so only the path is exposed.
  it('should provide access to the path', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      const handler = interceptor.connection('/rooms/:roomId');
      expect(handler.path).toBe('/rooms/:roomId');

      const handlerWithoutPath = interceptor.connection();
      expect(handlerWithoutPath.path).toBe(undefined);
    });
  });

  // Unlike HTTP requests, a connection needs no declared response, so a handler without one still matches and accepts.
  it('should match any connection if contains no declared response', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
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
      { type, baseURL, connectionSaving: { enabled: true } },
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

        await handler.clear();

        const secondAttempt = await openWebSocketUntilSettled(baseURL);
        expect(secondAttempt.eventTypes).toEqual(['error', 'close']);
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
      { type, baseURL, connectionSaving: { enabled: true } },
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
      { type, baseURL, connectionSaving: { enabled: true } },
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

  // No WebSocket counterpart for "should create response with declared status and body": a connection response declares
  // only an action to accept or reject the handshake, without a status or body.

  // No WebSocket counterpart for "should not throw an error if trying to create a response without a declared response":
  // a connection handler without a response matches and accepts the connection.

  it.each<{
    response: string;
    computeResponse: WebSocketConnectionHandlerResponseComputedDeclaration;
    expectedEventTypes: string[];
  }>([
    {
      response: 'synchronous accept',
      computeResponse: () => ({ action: 'accept' }),
      expectedEventTypes: ['open'],
    },
    {
      response: 'asynchronous accept',
      computeResponse: () => Promise.resolve({ action: 'accept' }),
      expectedEventTypes: ['open'],
    },
    {
      response: 'synchronous reject',
      computeResponse: () => ({ action: 'reject' }),
      expectedEventTypes: ['error', 'close'],
    },
    {
      response: 'asynchronous reject',
      computeResponse: () => Promise.resolve({ action: 'reject' }),
      expectedEventTypes: ['error', 'close'],
    },
  ])(
    'should decide connections with a $response computed response',
    async ({ computeResponse, expectedEventTypes }) => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.connection().respond(computeResponse);

        const { socket, eventTypes } = await openWebSocketUntilSettled(baseURL);
        socket.close();

        expect(eventTypes).toEqual(expectedEventTypes);
      });
    },
  );

  it('should compute responses with the connection request', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const responseFactory = vi.fn<WebSocketConnectionHandlerResponseComputedDeclaration<'/rooms/:roomId'>>(() => ({
        action: 'reject',
      }));

      await interceptor.connection('/rooms/:roomId').respond(responseFactory);

      const connectionURL = `${joinURL(baseURL, '/rooms/1')}?token=abc`;

      await openWebSocketUntilSettled(connectionURL, ['chat']);

      expect(responseFactory).toHaveBeenCalledTimes(1);
      expect(responseFactory).toHaveBeenCalledWith({
        url: connectionURL,
        protocols: ['chat'],
        searchParams: new HttpSearchParams({ token: 'abc' }),
        pathParams: { roomId: '1' },
      });
    });
  });

  it.each<{
    condition: string;
    declareAfterClear: (handler: WebSocketConnectionHandler<Schema>) => unknown;
  }>([
    { condition: 'cleared', declareAfterClear: (handler) => handler },
    { condition: 'cleared and redeclared', declareAfterClear: (handler) => handler.respond({ action: 'reject' }) },
  ])('should not decide connections if $condition while computing their response', async ({ declareAfterClear }) => {
    const responseStartedPromise = createPromiseWithResolvers<void>();
    const responseReleasedPromise = createPromiseWithResolvers<void>();

    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
      async (interceptor) => {
        const effect = vi.fn();

        const handler = await interceptor
          .connection()
          .effect(effect)
          .respond(async () => {
            responseStartedPromise.resolve();
            await responseReleasedPromise;
            return { action: 'reject' };
          });

        const attemptPromise = openWebSocketUntilSettled(baseURL);
        await responseStartedPromise;

        await declareAfterClear(handler.clear());
        responseReleasedPromise.resolve();

        // A connection no handler decides is accepted.
        const { socket, eventTypes } = await attemptPromise;
        socket.close();

        expect(eventTypes).toEqual(['open']);
        expect(effect).not.toHaveBeenCalled();
        expect(handler.connections).toHaveLength(0);

        await handler.times(0);
        await handler.checkTimes();
      },
    );
  });

  it.each([
    { response: 'accepted', declare: (handler: WebSocketConnectionHandler<Schema>) => handler.effect(vi.fn()) },
    {
      response: 'rejected',
      declare: (handler: WebSocketConnectionHandler<Schema>) => handler.respond({ action: 'reject' }),
    },
    {
      response: 'accepted by a computed response',
      declare: (handler: WebSocketConnectionHandler<Schema>) => handler.respond(() => ({ action: 'accept' })),
    },
    {
      response: 'rejected by a computed response',
      declare: (handler: WebSocketConnectionHandler<Schema>) => handler.respond(() => ({ action: 'reject' })),
    },
  ])('should keep track of the intercepted connections ($response)', async ({ declare }) => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await declare(interceptor.connection());

        expect(handler.connections).toEqual([]);

        const { socket: firstSocket } = await openWebSocketUntilSettled(`${baseURL}?room=1`, ['chat', 'json']);
        firstSocket.close();

        const firstConnection = {
          url: firstSocket.url,
          protocols: ['chat', 'json'],
          searchParams: new HttpSearchParams({ room: '1' }),
          pathParams: {},
        };

        expect(handler.connections).toEqual([firstConnection]);

        const { socket: secondSocket } = await openWebSocketUntilSettled(`${baseURL}?room=2`, ['chat']);
        secondSocket.close();

        expect(handler.connections).toEqual([
          firstConnection,
          {
            url: secondSocket.url,
            protocols: ['chat'],
            searchParams: new HttpSearchParams({ room: '2' }),
            pathParams: {},
          },
        ]);
      },
    );
  });

  it('should clear the intercepted connections after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
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

  // No WebSocket counterpart for "should provide access to the raw intercepted requests and responses": a handshake has
  // no body to read and answers with no response body, so saved connections have no raw request or response.

  // No WebSocket counterpart for "should provide no access to hidden properties in raw intercepted requests and responses":
  // a handshake has no body to read and answers with no response body, so saved connections have no raw request or
  // response to hide properties from.

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor
          .connection()
          .with(() => false)
          .respond({ action: 'reject' })
          .times(1);

        const { socket } = await openWebSocketUntilSettled(baseURL);
        socket.close();

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: [
            'Expected exactly 1 matching connection, but got 0.',
            '',
            'Connections evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: ${socket.url}`,
            '     Computed restriction:',
            `       ${color.green('- return true')}`,
            `       ${color.red('+ return false')}`,
          ].join('\n'),
          expectedNumberOfMatches: 1,
        });

        await handler.clear().respond({ action: 'reject' }).times(1);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 1 connection, but got 0.',
          expectedNumberOfMatches: 1,
        });

        const attempt = await openWebSocketUntilSettled(baseURL);
        expect(attempt.eventTypes).toEqual(['error', 'close']);
        expect(attempt.closeEvent?.code).toBe(WEB_SOCKET_CLOSE_CODES.ABNORMAL_CLOSURE);

        await handler.checkTimes();
      },
    );
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
