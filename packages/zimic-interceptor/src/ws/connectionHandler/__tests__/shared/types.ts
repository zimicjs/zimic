import { expectTypeOf, it } from 'vitest';

import {
  InterceptedWebSocketInterceptorConnection,
  WebSocketInterceptorClient,
} from '../../../interceptor/types/messages';
import type {
  LocalWebSocketConnectionHandler,
  PendingRemoteWebSocketConnectionHandler,
  SyncedRemoteWebSocketConnectionHandler,
} from '../../types/public';
import { Schema } from './utils';

// The handlers below are only type-checked. The functions declaring them are never called.
export function declareTypeWebSocketConnectionHandlerTests() {
  it('should type connection attempts in computed restrictions and delays, and clients in effects', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler
        .with((connection) => {
          expectTypeOf(connection).toEqualTypeOf<InterceptedWebSocketInterceptorConnection>();
          return connection.protocols.includes('chat');
        })
        .delay((connection) => {
          expectTypeOf(connection).toEqualTypeOf<InterceptedWebSocketInterceptorConnection>();
          return 0;
        })
        .effect((client) => {
          expectTypeOf(client).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
        });

      expectTypeOf(handler.connections).toEqualTypeOf<readonly InterceptedWebSocketInterceptorConnection[]>();
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should accept static restrictions with search params, protocols, and exact', () => {
    function declareStaticRestrictions(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.with({ searchParams: { room: '1', tag: ['a', 'b'] } });
      handler.with({ searchParams: new URLSearchParams('room=1'), exact: true });
      handler.with({ protocols: ['chat'], exact: false });

      // @ts-expect-error Search param values must be strings.
      handler.with({ searchParams: { room: 1 } });

      // @ts-expect-error Protocols must be a list.
      handler.with({ protocols: 'chat' });

      // @ts-expect-error Unknown restriction fields are not accepted.
      handler.with({ headers: {} });
    }

    expectTypeOf(declareStaticRestrictions).toBeFunction();
  });

  it('should accept only reject actions as responses', () => {
    function declareResponses(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.respond({ action: 'reject' });

      // @ts-expect-error Connections cannot be bypassed, because remote interceptors have no real server.
      handler.respond({ action: 'bypass' });

      // @ts-expect-error Connection responses carry no message data.
      handler.respond({ type: 'chat', text: 'hello' });

      // @ts-expect-error Connection responses are not computed.
      handler.respond(() => ({ action: 'reject' }));
    }

    expectTypeOf(declareResponses).toBeFunction();
  });

  it('should correctly type local and remote sync return values', () => {
    function declareHandlers(
      localHandler: LocalWebSocketConnectionHandler<Schema>,
      remoteHandler: PendingRemoteWebSocketConnectionHandler<Schema>,
    ) {
      expectTypeOf(localHandler.with({}).respond({ action: 'reject' }).times(1).clear()).toEqualTypeOf<
        LocalWebSocketConnectionHandler<Schema>
      >();
      expectTypeOf(localHandler.checkTimes).returns.toEqualTypeOf<void>();

      expectTypeOf(remoteHandler.with({}).respond({ action: 'reject' }).times(1).clear()).toEqualTypeOf<
        PendingRemoteWebSocketConnectionHandler<Schema>
      >();
      expectTypeOf(remoteHandler.checkTimes).returns.toEqualTypeOf<Promise<void>>();

      async function awaitRemoteHandler() {
        const syncedHandler = await remoteHandler.delay(1, 2);
        expectTypeOf(syncedHandler).toEqualTypeOf<SyncedRemoteWebSocketConnectionHandler<Schema>>();
      }

      expectTypeOf(awaitRemoteHandler).toBeFunction();
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });
}
