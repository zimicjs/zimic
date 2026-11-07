import { describe, expectTypeOf, it } from 'vitest';

import { WebSocketInterceptorClient, WebSocketInterceptorConnectionRequest } from '../../interceptor/types/messages';
import type { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../../interceptor/types/public';
import type {
  LocalWebSocketConnectionHandler,
  PendingRemoteWebSocketConnectionHandler,
  SyncedRemoteWebSocketConnectionHandler,
} from '../types/public';
import { Schema } from './shared/utils';

// The handlers below are only type-checked. The functions declaring them are never called.
describe('WebSocketConnectionHandler > Types', () => {
  it('should type connections in computed restrictions', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.with((request) => {
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
        return request.protocols.includes('chat');
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type connections in computed delays', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.delay((request) => {
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
        return 0;
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type connections in computed responses', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.respond((request) => {
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
        return { action: 'accept' };
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type clients in effects', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.effect((client, request) => {
        expectTypeOf(client).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type saved connections', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
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
        .respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();
          return { action: 'accept' };
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
        .respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();
          return { action: 'accept' };
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

  it('should type connections while chaining static and computed restrictions', () => {
    function declareChainedRestrictions(
      localHandler: LocalWebSocketConnectionHandler<Schema>,
      remoteHandler: PendingRemoteWebSocketConnectionHandler<Schema>,
    ) {
      const restrictedLocalHandler = localHandler.with({ protocols: ['chat'] }).with((request) => {
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
        return true;
      });
      expectTypeOf(restrictedLocalHandler).toEqualTypeOf<LocalWebSocketConnectionHandler<Schema>>();

      const restrictedRemoteHandler = remoteHandler
        .with((request) => {
          expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
          return true;
        })
        .with({ protocols: ['chat'] });
      expectTypeOf(restrictedRemoteHandler).toEqualTypeOf<PendingRemoteWebSocketConnectionHandler<Schema>>();
    }

    expectTypeOf(declareChainedRestrictions).toBeFunction();
  });

  it('should accept exact options only in static restrictions', () => {
    function declareExactRestrictions(
      localHandler: LocalWebSocketConnectionHandler<Schema>,
      remoteHandler: SyncedRemoteWebSocketConnectionHandler<Schema>,
    ) {
      localHandler.with(() => true);
      remoteHandler.with(() => true);

      // @ts-expect-error Computed restrictions do not accept options.
      localHandler.with(() => true, { exact: true });

      // @ts-expect-error Computed restrictions do not accept options.
      remoteHandler.with(() => true, { exact: true });

      // @ts-expect-error Invalid static restriction option.
      localHandler.with({ protocols: ['chat'], exact: 'true' });
    }

    expectTypeOf(declareExactRestrictions).toBeFunction();
  });

  it('should accept only accept and reject actions as responses', () => {
    function declareResponses(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.respond({ action: 'accept' });
      handler.respond({ action: 'reject' });

      handler.respond(() => ({ action: 'accept' }));
      handler.respond(() => ({ action: 'reject' }));
      handler.respond(() => Promise.resolve({ action: 'accept' }));
      handler.respond(async () => {
        await Promise.resolve();
        return { action: 'reject' };
      });

      // @ts-expect-error Connections cannot be bypassed, because remote interceptors have no real server.
      handler.respond({ action: 'bypass' });

      // @ts-expect-error Connections cannot be bypassed, because remote interceptors have no real server.
      handler.respond(() => ({ action: 'bypass' }));

      // @ts-expect-error Connection responses carry no message data.
      handler.respond({ type: 'chat', text: 'hello' });

      // @ts-expect-error Connection responses carry no message data.
      handler.respond(() => ({ type: 'chat', text: 'hello' }));
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

        const clearedHandler = syncedHandler.clear();
        expectTypeOf(clearedHandler).toEqualTypeOf<PendingRemoteWebSocketConnectionHandler<Schema>>();
        expectTypeOf(await clearedHandler).toEqualTypeOf<SyncedRemoteWebSocketConnectionHandler<Schema>>();
      }

      expectTypeOf(awaitRemoteHandler).toBeFunction();
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });
});
