import { WebSocketSchema } from '@zimic/ws';
import { describe, expectTypeOf, it } from 'vitest';

import type {
  LocalWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler,
} from '@/ws/messageHandler/types/public';

import { createWebSocketInterceptor } from '../factory';
import { UnhandledWebSocketInterceptorMessage } from '../types/messages';
import { UnhandledMessageStrategy, WebSocketInterceptorOptions, WebSocketInterceptorType } from '../types/options';
import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../types/public';
import { InferWebSocketInterceptorSchema } from '../types/schema';
import { declareWebSocketInterceptorTypes } from './shared/utils';

type Message = { type: 'create'; body: { text: string } } | { type: 'delete'; id: string };

type MessageSchema = WebSocketSchema<{
  '/': {
    message: Message;
  };
}>;

type PathKeyedSchema = WebSocketSchema<{
  '/rooms/:roomId': {
    message: { type: 'chat'; text: string };
  };
  '/health': {
    message: { type: 'ping' };
  };
}>;

// The interceptors below are only type-checked. The functions declaring them are never called.
describe('WebSocketInterceptor > Types', () => {
  it('should type message handlers with the messages of the declared path', () => {
    declareWebSocketInterceptorTypes<PathKeyedSchema>((interceptor) => {
      expectTypeOf(interceptor.message('/rooms/:roomId')).toEqualTypeOf<
        | LocalWebSocketMessageHandler<PathKeyedSchema, '/rooms/:roomId'>
        | PendingRemoteWebSocketMessageHandler<PathKeyedSchema, '/rooms/:roomId'>
      >();

      expectTypeOf(interceptor.message('/rooms/1')).toEqualTypeOf<
        | LocalWebSocketMessageHandler<PathKeyedSchema, '/rooms/:roomId'>
        | PendingRemoteWebSocketMessageHandler<PathKeyedSchema, '/rooms/:roomId'>
      >();
    });
  });

  it('should type message handlers with the messages of all paths if no path is declared', () => {
    declareWebSocketInterceptorTypes<PathKeyedSchema>((interceptor) => {
      expectTypeOf(interceptor.message()).toEqualTypeOf<
        LocalWebSocketMessageHandler<PathKeyedSchema> | PendingRemoteWebSocketMessageHandler<PathKeyedSchema>
      >();
    });
  });

  it('should accept a client from a path-specific effect as the target of a server message', () => {
    declareWebSocketInterceptorTypes<PathKeyedSchema>((interceptor) => {
      interceptor.connection('/rooms/:roomId').effect((client) => {
        interceptor.server.send({ type: 'chat', text: 'hello' }, { to: client });
      });
    });
  });

  it('should not accept options of a schema with messages other than the messages of the schema', () => {
    function createInterceptor(options: WebSocketInterceptorOptions<PathKeyedSchema>) {
      // @ts-expect-error The protocol of the options does not translate the messages of the schema.
      createWebSocketInterceptor<MessageSchema>(options);
    }

    expectTypeOf(createInterceptor).toBeFunction();
  });

  it('should not accept undeclared paths in message handlers', () => {
    declareWebSocketInterceptorTypes<PathKeyedSchema>((interceptor) => {
      // @ts-expect-error The path is not declared in the schema.
      interceptor.message('/unknown');
    });
  });

  it('should correctly type local and remote factory return values', () => {
    function declareInterceptors(type: WebSocketInterceptorType, baseURL: string) {
      const localInterceptor = createWebSocketInterceptor<MessageSchema>({ baseURL });
      expectTypeOf(localInterceptor).toEqualTypeOf<LocalWebSocketInterceptor<MessageSchema>>();

      const explicitLocalInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'local', baseURL });
      expectTypeOf(explicitLocalInterceptor).toEqualTypeOf<LocalWebSocketInterceptor<MessageSchema>>();

      const remoteInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'remote', baseURL });
      expectTypeOf(remoteInterceptor).toEqualTypeOf<RemoteWebSocketInterceptor<MessageSchema>>();

      const unionInterceptor = createWebSocketInterceptor<MessageSchema>({
        type,
        baseURL,
      });
      expectTypeOf(unionInterceptor).toEqualTypeOf<
        LocalWebSocketInterceptor<MessageSchema> | RemoteWebSocketInterceptor<MessageSchema>
      >();
    }

    expectTypeOf(declareInterceptors).toBeFunction();
  });

  it('should correctly type schemas inferred from public interceptor types', () => {
    type LocalSchema = InferWebSocketInterceptorSchema<LocalWebSocketInterceptor<MessageSchema>>;
    expectTypeOf<LocalSchema>().toEqualTypeOf<MessageSchema>();

    type RemoteSchema = InferWebSocketInterceptorSchema<RemoteWebSocketInterceptor<MessageSchema>>;
    expectTypeOf<RemoteSchema>().toEqualTypeOf<MessageSchema>();

    type UnknownSchema = InferWebSocketInterceptorSchema<unknown>;
    expectTypeOf<UnknownSchema>().toEqualTypeOf<never>();
  });

  describe('Unhandled messages', () => {
    // No WebSocket counterpart for "should correctly type the unhandled request strategy": WebSocket strategies do not differ between local and remote interceptors.

    it('should type unhandled message factories with the messages of the schema', () => {
      function declareInterceptor(baseURL: string) {
        type Schema = WebSocketSchema<{
          '/': {
            message: Message | Blob | number;
          };
        }>;

        createWebSocketInterceptor<Schema>({
          baseURL,
          onUnhandledMessage(message) {
            expectTypeOf(message).toEqualTypeOf<UnhandledWebSocketInterceptorMessage<Schema>>();
            expectTypeOf(message).toEqualTypeOf<Message | ArrayBuffer | `${number}`>();
            return { log: true };
          },
        });
      }

      expectTypeOf(declareInterceptor).toBeFunction();
    });

    it('should accept unhandled message strategies of the default schema', () => {
      function declareInterceptor(baseURL: string, onUnhandledMessage: UnhandledMessageStrategy) {
        createWebSocketInterceptor<MessageSchema>({ baseURL, onUnhandledMessage });
      }

      expectTypeOf(declareInterceptor).toBeFunction();
    });
  });
});
