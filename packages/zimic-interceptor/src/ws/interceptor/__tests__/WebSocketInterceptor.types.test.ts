import { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';
import { describe, expectTypeOf, it } from 'vitest';

import type { LocalWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { createWebSocketInterceptor } from '../factory';
import { WebSocketInterceptorOptions, WebSocketInterceptorType } from '../types/options';
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

describe('WebSocketInterceptor > Types', () => {
  it('should type message handlers with the messages of the declared path', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      expectTypeOf(interceptor.message('/rooms/:roomId')).toEqualTypeOf<
        LocalWebSocketMessageHandler<PathKeyedSchema, '/rooms/:roomId'>
      >();

      expectTypeOf(interceptor.message('/rooms/1')).toEqualTypeOf<
        LocalWebSocketMessageHandler<PathKeyedSchema, '/rooms/:roomId'>
      >();
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type message handlers with the messages of all paths if no path is declared', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      expectTypeOf(interceptor.message()).toEqualTypeOf<LocalWebSocketMessageHandler<PathKeyedSchema>>();
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should accept a client from a path-specific effect as the target of a server message', () => {
    function declareSend(
      interceptor: LocalWebSocketInterceptor<PathKeyedSchema>,
      data: WebSocketMessageData<WebSocketSchemaMessage<PathKeyedSchema>>,
    ) {
      interceptor.connection('/rooms/:roomId').effect((client) => {
        interceptor.server.send(data, { to: client });
      });
    }

    expectTypeOf(declareSend).toBeFunction();
  });

  it('should not accept messages that are not declared in the schema in server sends', () => {
    function declareSend(interceptor: LocalWebSocketInterceptor<MessageSchema>) {
      interceptor.server.send(
        // @ts-expect-error The message is not declared in the schema.
        { type: 'unknown' },
      );
    }

    expectTypeOf(declareSend).toBeFunction();
  });

  it('should not accept messages that are not declared in the schema in client sends', () => {
    function declareSend(interceptor: LocalWebSocketInterceptor<MessageSchema>) {
      const client = interceptor.clients[0];

      client.send(
        // @ts-expect-error The message is not declared in the schema.
        { type: 'unknown' },
      );
    }

    expectTypeOf(declareSend).toBeFunction();
  });

  it('should not accept options of a schema with messages other than the messages of the schema', () => {
    function createInterceptor(options: WebSocketInterceptorOptions<PathKeyedSchema>) {
      // @ts-expect-error The protocol of the options does not translate the messages of the schema.
      createWebSocketInterceptor<MessageSchema>(options);
    }

    expectTypeOf(createInterceptor).toBeFunction();
  });

  it('should not accept undeclared paths in message handlers', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      // @ts-expect-error The path is not declared in the schema.
      interceptor.message('/unknown');
    }

    expectTypeOf(declareHandlers).toBeFunction();
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

  it('should not accept the interceptor server as a sender restriction', () => {
    declareWebSocketInterceptorTypes<MessageSchema>((interceptor) => {
      // @ts-expect-error Interceptor server handles cannot restrict client senders.
      interceptor.message().from(interceptor.server);
    });
  });

  it('should correctly type schemas inferred from public interceptor types', () => {
    type LocalSchema = InferWebSocketInterceptorSchema<LocalWebSocketInterceptor<MessageSchema>>;
    expectTypeOf<LocalSchema>().toEqualTypeOf<MessageSchema>();

    type RemoteSchema = InferWebSocketInterceptorSchema<RemoteWebSocketInterceptor<MessageSchema>>;
    expectTypeOf<RemoteSchema>().toEqualTypeOf<MessageSchema>();

    type UnknownSchema = InferWebSocketInterceptorSchema<unknown>;
    expectTypeOf<UnknownSchema>().toEqualTypeOf<never>();
  });

  it('should correctly type restricted message callbacks', () => {
    declareWebSocketInterceptorTypes<MessageSchema>((interceptor) => {
      interceptor
        .message()
        .with({ type: 'create' })
        .respond((message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<Message, { type: 'create' }>>();
          return { type: 'delete', id: message.body.text };
        });

      function declareInvalidMessages() {
        // @ts-expect-error Invalid static restriction.
        interceptor.message().with({ type: 'update' });

        // @ts-expect-error Invalid static response.
        interceptor.message().respond({ type: 'update' });
      }

      expectTypeOf(declareInvalidMessages).toBeFunction();
    });
  });
});
