import { HttpSearchParams } from '@zimic/utils/http';
import { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';
import { describe, expectTypeOf, it } from 'vitest';

import { WebSocketInterceptorClient, WebSocketInterceptorConnectionRequest } from '../../interceptor/types/messages';
import type { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../../interceptor/types/public';
import type {
  LocalWebSocketConnectionHandler,
  PendingRemoteWebSocketConnectionHandler,
  SyncedRemoteWebSocketConnectionHandler,
} from '../types/public';
import { Schema } from './shared/utils';

type PathKeyedSchema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: { searchParams: { token: string }; protocols: 'chat' | 'json' };
    message: { type: 'chat'; text: string };
  };
  '/health': { message: { type: 'ping' } };
}>;

// The handlers below are only type-checked. The functions declaring them are never called.
describe('WebSocketConnectionHandler > Types', () => {
  it('should accept only declared paths and their concrete forms', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.connection('/rooms/:roomId');
      interceptor.connection('/rooms/1');
      interceptor.connection('/health');
      interceptor.connection();

      // @ts-expect-error The path is not declared in the schema.
      interceptor.connection('/unknown');
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type search params from the declared path', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      const handler = interceptor.connection('/rooms/:roomId');

      handler.with({ searchParams: { token: 'value' } });

      // @ts-expect-error The search param is not declared in the schema.
      handler.with({ searchParams: { undeclared: 'value' } });

      handler.with((request) => {
        expectTypeOf(request.searchParams.get('token')).toEqualTypeOf<string>();

        // @ts-expect-error The search param is not declared in the schema.
        return request.searchParams.has('undeclared');
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type protocols from the declared path', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      const handler = interceptor.connection('/rooms/:roomId');

      handler.with({ protocols: ['chat', 'json'] });

      // @ts-expect-error The subprotocol is not declared in the schema.
      handler.with({ protocols: ['undeclared'] });

      handler.with((request) => {
        expectTypeOf(request.protocols).toEqualTypeOf<readonly ('chat' | 'json')[]>();
        return true;
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should not accept search params or protocols on paths that declare no connection', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      const handler = interceptor.connection('/health');

      // @ts-expect-error The path declares no search params.
      handler.with({ searchParams: { token: 'value' } });

      // @ts-expect-error The path declares no subprotocols.
      handler.with({ protocols: ['chat'] });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type client search params from the declared path', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.connection('/rooms/:roomId').effect((client) => {
        expectTypeOf(client.searchParams.get('token')).toEqualTypeOf<string>();

        // @ts-expect-error The search param is not declared in the schema.
        client.searchParams.has('undeclared');
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type client search params as declared if no path is declared in a schema with one path', () => {
    type SinglePathSchema = WebSocketSchema<{
      '/rooms/:roomId': { connection: { searchParams: { token: string } }; message: { type: 'chat'; text: string } };
    }>;

    function declareHandlers(interceptor: LocalWebSocketInterceptor<SinglePathSchema>) {
      interceptor.connection().effect((client) => {
        expectTypeOf(client.searchParams.get('token')).toEqualTypeOf<string>();
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type client search params of all paths as optional if no path is declared in a schema with multiple paths', () => {
    type MultiplePathSchema = WebSocketSchema<{
      '/rooms/:roomId': { connection: { searchParams: { token: string } }; message: { type: 'chat'; text: string } };
      '/logs': { connection: { searchParams: { level: string } }; message: { type: 'log' } };
      '/health': { message: { type: 'ping' } };
    }>;

    function declareHandlers(interceptor: LocalWebSocketInterceptor<MultiplePathSchema>) {
      const handler = interceptor.connection();

      handler.with({ searchParams: { token: 'value' } });
      handler.with({ searchParams: { level: 'debug' } });

      // @ts-expect-error The search param is not declared in the schema.
      handler.with({ searchParams: { undeclared: 'value' } });

      handler.effect((client) => {
        expectTypeOf(client.searchParams.get('token')).toEqualTypeOf<string | null>();
        expectTypeOf(client.searchParams.get('level')).toEqualTypeOf<string | null>();

        // @ts-expect-error The search param is not declared in the schema.
        client.searchParams.has('undeclared');
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type client protocols from the declared path', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.connection('/rooms/:roomId').effect((client) => {
        expectTypeOf(client.protocols).toEqualTypeOf<readonly ('chat' | 'json')[]>();
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type concrete paths from their declared path', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.connection('/rooms/1').effect((client) => {
        expectTypeOf(client).toEqualTypeOf<WebSocketInterceptorClient<PathKeyedSchema, '/rooms/:roomId'>>();
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type clients with the messages of the declared path', () => {
    function declareHandlers(
      interceptor: LocalWebSocketInterceptor<PathKeyedSchema>,
      healthMessage: WebSocketMessageData<{ type: 'ping' }>,
    ) {
      interceptor.connection('/rooms/:roomId').effect((client) => {
        expectTypeOf<Parameters<typeof client.send>[0]>().toEqualTypeOf<
          WebSocketMessageData<{ type: 'chat'; text: string }>
        >();

        // @ts-expect-error The message belongs to another path.
        client.send(healthMessage);
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type clients with the messages of all paths if no path is declared', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.connection().effect((client) => {
        expectTypeOf(client).toEqualTypeOf<WebSocketInterceptorClient<PathKeyedSchema>>();
        expectTypeOf<Parameters<typeof client.send>[0]>().toEqualTypeOf<
          WebSocketMessageData<WebSocketSchemaMessage<PathKeyedSchema>>
        >();
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type connections in computed restrictions', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.with((request) => {
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest<Schema>>();
        return request.protocols.includes('chat');
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type connections in computed delays', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.delay((request) => {
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest<Schema>>();
        return 0;
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type connections in computed responses', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.respond((request) => {
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest<Schema>>();
        return { action: 'accept' };
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type clients in effects', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.effect((client, request) => {
        expectTypeOf(client).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest<Schema>>();
      });
    }

    expectTypeOf(declareLocalHandler).toBeFunction();
  });

  it('should type saved connections', () => {
    function declareLocalHandler(handler: LocalWebSocketConnectionHandler<Schema>) {
      expectTypeOf(handler.connections).toEqualTypeOf<readonly WebSocketInterceptorConnectionRequest<Schema>[]>();
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
        readonly WebSocketInterceptorConnectionRequest<Schema, '/rooms/:roomId'>[]
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
          readonly WebSocketInterceptorConnectionRequest<Schema, '/rooms/:roomId'>[]
        >();
      }

      expectTypeOf(awaitRemoteHandler).toBeFunction();

      const roomId = '1' as string;

      localInterceptor.connection(`/rooms/${roomId}`).with((request) => {
        expectTypeOf(request.pathParams).toEqualTypeOf<{ roomId: string }>();
        return true;
      });

      localInterceptor.connection().with((request) => {
        expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
        return true;
      });
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type the declared path', () => {
    function declareHandlers(
      localInterceptor: LocalWebSocketInterceptor<Schema>,
      remoteInterceptor: RemoteWebSocketInterceptor<Schema>,
    ) {
      expectTypeOf(localInterceptor.connection('/rooms/:roomId').path).toEqualTypeOf<'/rooms/:roomId' | undefined>();
      expectTypeOf(remoteInterceptor.connection('/rooms/:roomId').path).toEqualTypeOf<'/rooms/:roomId' | undefined>();
      expectTypeOf(localInterceptor.connection().path).toEqualTypeOf<string | undefined>();
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should accept static restrictions with search params, protocols, and exact', () => {
    function declareStaticRestrictions(handler: LocalWebSocketConnectionHandler<Schema>) {
      handler.with({ searchParams: { room: '1', tag: ['a', 'b'] } });
      handler.with({ searchParams: new HttpSearchParams('room=1'), exact: true });
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
        expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest<Schema>>();
        return true;
      });
      expectTypeOf(restrictedLocalHandler).toEqualTypeOf<LocalWebSocketConnectionHandler<Schema>>();

      const restrictedRemoteHandler = remoteHandler
        .with((request) => {
          expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest<Schema>>();
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
