import { expectTypeOf, it } from 'vitest';

import { WebSocketInterceptorClient, WebSocketInterceptorConnectionRequest } from '../../../interceptor/types/messages';
import type { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../../../interceptor/types/public';
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
        .with((request) => {
          expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
          return request.protocols.includes('chat');
        })
        .delay((request) => {
          expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
          return 0;
        })
        .effect((client, request) => {
          expectTypeOf(client).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
          expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
        });

      expectTypeOf(handler.connections).toEqualTypeOf<readonly WebSocketInterceptorConnectionRequest[]>();
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type path params from the declared path', () => {
    function declareHandlers(
      localInterceptor: LocalWebSocketInterceptor<Schema>,
      remoteInterceptor: RemoteWebSocketInterceptor<Schema>,
    ) {
      localInterceptor
        .connection('/rooms/:roomId')
        .with((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();

          // @ts-expect-error The path does not declare this param.
          return request.pathParams.userId === '1';
        })
        .delay((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();
          return 0;
        })
        .effect((_client, request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();

          // @ts-expect-error The path does not declare this param.
          expectTypeOf(request.pathParams.userId).toBeString();
        });

      expectTypeOf(localInterceptor.connection('/rooms/:roomId').connections).toEqualTypeOf<
        readonly WebSocketInterceptorConnectionRequest<'/rooms/:roomId'>[]
      >();

      remoteInterceptor
        .connection('/rooms/:roomId')
        .with((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();

          // @ts-expect-error The path does not declare this param.
          return request.pathParams.userId === '1';
        })
        .delay((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();
          return 0;
        })
        .effect((_client, request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();

          // @ts-expect-error The path does not declare this param.
          expectTypeOf(request.pathParams.userId).toBeString();
        });

      async function awaitRemoteHandler() {
        const syncedHandler = await remoteInterceptor.connection('/rooms/:roomId');
        expectTypeOf(syncedHandler.connections).toEqualTypeOf<
          readonly WebSocketInterceptorConnectionRequest<'/rooms/:roomId'>[]
        >();
      }

      expectTypeOf(awaitRemoteHandler).toBeFunction();

      const roomId = '1' as string;

      localInterceptor.connection(`/rooms/${roomId}`).with((request) => {
        expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
        return true;
      });

      localInterceptor.connection().with((request) => {
        expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
        return true;
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
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
