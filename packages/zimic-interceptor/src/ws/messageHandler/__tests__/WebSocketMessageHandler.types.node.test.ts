import { HttpSearchParams } from '@zimic/utils/http';
import { JSONStringified, WebSocketMessageData, WebSocketMessageSchema, WebSocketSchema } from '@zimic/ws';
import { describe, expectTypeOf, it } from 'vitest';

import {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
} from '../../interceptor/types/messages';
import type { LocalWebSocketInterceptor } from '../../interceptor/types/public';
import type {
  LocalWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler,
  SyncedRemoteWebSocketMessageHandler,
} from '../types/public';
import { ChatMessage, Schema } from './shared/utils';

type SinglePathSchema<Message extends WebSocketMessageSchema> = WebSocketSchema<{ '/': { message: Message } }>;

interface RoomMessage {
  type: 'chat';
  text: string;
}
interface HealthMessage {
  type: 'ping';
}

type PathKeyedSchema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: { searchParams: { token: string }; protocols: 'chat' };
    message: RoomMessage;
  };
  '/health': { message: HealthMessage };
}>;

type CreateMessage = Extract<ChatMessage, { type: 'create' }>;
type PrioritizedCreateMessage = CreateMessage & {
  body: CreateMessage['body'] & { priority: number };
};

type NestedSchema =
  | {
      type: 'create';
      body: {
        text: string;
        details?: { priority: number };
      };
    }
  | {
      type: 'create';
      body: {
        count: number;
        details?: { label: string };
      };
    }
  | { type: 'delete'; id: string };

// The handlers below are only type-checked. The functions declaring them are never called.
describe('WebSocketMessageHandler > Types', () => {
  it('should type the receiver of a path-specific handler with the messages of all paths', () => {
    function declareHandler(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.message('/rooms/:roomId').effect((_message, context) => {
        expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorServer<PathKeyedSchema>>();
        expectTypeOf(context.receiver.send)
          .parameter(0)
          .toEqualTypeOf<WebSocketMessageData<RoomMessage | HealthMessage>>();
      });
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should accept a connected client in the sender restriction of a path-specific handler', () => {
    function declareHandler(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.message('/rooms/:roomId').from(interceptor.clients[0]);
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should accept a client from a path-specific effect in the sender restriction of a handler without a path', () => {
    function declareHandler(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.connection('/rooms/:roomId').effect((client) => {
        interceptor.message().from(client);
      });
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should type the sender from the handler path', () => {
    function declareHandler(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      interceptor.message('/rooms/:roomId').effect((_message, context) => {
        expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<PathKeyedSchema, '/rooms/:roomId'>>();
        expectTypeOf(context.sender.searchParams).toEqualTypeOf<HttpSearchParams<{ token: string }>>();
      });
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should type the handler path from the declared path', () => {
    function declareHandler(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      expectTypeOf(interceptor.message('/rooms/:roomId').path).toEqualTypeOf<'/rooms/:roomId' | undefined>();
      expectTypeOf(interceptor.message('/rooms/1').path).toEqualTypeOf<'/rooms/:roomId' | undefined>();
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should narrow message schemas through static restrictions', () => {
    function declareStaticRestriction(handler: LocalWebSocketMessageHandler<Schema>) {
      handler.with({ type: 'create' }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<CreateMessage>();
        expectTypeOf(message.body.text).toEqualTypeOf<string>();
      });
    }

    expectTypeOf(declareStaticRestriction).toBeFunction();
  });

  it('should narrow compatible union members through partial static restrictions', () => {
    function declarePartialStaticRestrictions(handler: LocalWebSocketMessageHandler<SinglePathSchema<NestedSchema>>) {
      handler.with({ body: { text: 'hello' } }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Extract<NestedSchema, { body: { text: string } }>>();
      });

      handler.with({ body: { details: { priority: 1 } } }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Extract<NestedSchema, { body: { text: string } }>>();
      });

      handler
        .with({ type: 'create' })
        .with({ body: { count: 1 } })
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<NestedSchema, { body: { count: number } }>>();
        });
    }

    expectTypeOf(declarePartialStaticRestrictions).toBeFunction();
  });

  it('should reset cleared handler return types to the root schema', () => {
    function declareLocalClear(handler: LocalWebSocketMessageHandler<Schema, string, CreateMessage>) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<LocalWebSocketMessageHandler<Schema>>();

      clearedHandler
        .with({ type: 'delete' })
        .delay((message) => message.id.length)
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<ChatMessage, { type: 'delete' }>>();
        })
        .respond({ type: 'create', body: { text: 'response' } })
        .times(1);
    }

    function declarePendingRemoteClear(handler: PendingRemoteWebSocketMessageHandler<Schema, string, CreateMessage>) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<PendingRemoteWebSocketMessageHandler<Schema>>();

      clearedHandler.respond({ type: 'delete', id: '1' }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<ChatMessage>();
      });
    }

    async function declareSyncedRemoteClear(
      handler: SyncedRemoteWebSocketMessageHandler<Schema, string, CreateMessage>,
    ) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<PendingRemoteWebSocketMessageHandler<Schema>>();

      const syncedHandler = await clearedHandler;
      expectTypeOf(syncedHandler).toEqualTypeOf<SyncedRemoteWebSocketMessageHandler<Schema>>();
    }

    expectTypeOf(declareLocalClear).toBeFunction();
    expectTypeOf(declarePendingRemoteClear).toBeFunction();
    expectTypeOf(declareSyncedRemoteClear).toBeFunction();
  });

  it('should preserve the root schema while chaining static and computed restrictions', () => {
    function hasPriority(message: CreateMessage): message is PrioritizedCreateMessage {
      return message.body.priority !== undefined;
    }

    function declareChainedRestrictions(handler: LocalWebSocketMessageHandler<Schema>) {
      const restrictedHandler = handler.with({ type: 'create' }).with(hasPriority);

      restrictedHandler.delay((message) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        return message.body.priority;
      });

      restrictedHandler.effect((message, context) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
        expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorServer<Schema>>();
      });

      restrictedHandler.respond((message, context) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
        expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorServer<Schema>>();

        return { type: 'delete', id: message.body.text };
      });

      expectTypeOf<typeof restrictedHandler.messages>().toEqualTypeOf<
        readonly InterceptedWebSocketInterceptorMessage<Schema, string, PrioritizedCreateMessage>[]
      >();
    }

    expectTypeOf(declareChainedRestrictions).toBeFunction();
  });

  it('should accept exact options only in static restrictions', () => {
    function declareExactRestrictions(
      localHandler: LocalWebSocketMessageHandler<Schema>,
      remoteHandler: SyncedRemoteWebSocketMessageHandler<Schema>,
    ) {
      localHandler.with({ type: 'create' }, { exact: true }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<CreateMessage>();
      });

      remoteHandler.with({ type: 'create' }, { exact: false }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<CreateMessage>();
      });

      localHandler.with({ type: 'create' }, {});
      localHandler.with({ type: 'create' });

      function isCreateMessage(message: ChatMessage): message is CreateMessage {
        return message.type === 'create';
      }

      localHandler.with(isCreateMessage);

      // @ts-expect-error Computed restrictions do not accept options.
      localHandler.with(isCreateMessage, { exact: true });

      // @ts-expect-error Computed restrictions do not accept options.
      remoteHandler.with(isCreateMessage, {});

      // @ts-expect-error Invalid static restriction option.
      localHandler.with({ type: 'create' }, { exact: 'true' });
    }

    expectTypeOf(declareExactRestrictions).toBeFunction();
  });

  it('should accept boolean computed restrictions without narrowing message schemas', () => {
    function declareBooleanRestriction(handler: LocalWebSocketMessageHandler<Schema>) {
      handler
        .with((message): boolean => message.type === 'create')
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<ChatMessage>();
        });
    }

    expectTypeOf(declareBooleanRestriction).toBeFunction();
  });

  it('should receive binary schema members as ArrayBuffer', () => {
    type BinarySchema = Blob | { type: 'a' };
    type ReceivedBinaryMessage = ArrayBuffer | Extract<BinarySchema, { type: 'a' }>;

    function declareBinaryHandlers(handler: LocalWebSocketMessageHandler<SinglePathSchema<BinarySchema>>) {
      const restrictedHandler = handler
        .with((message) => {
          expectTypeOf(message).toEqualTypeOf<ReceivedBinaryMessage>();
          return true;
        })
        .delay((message) => {
          expectTypeOf(message).toEqualTypeOf<ReceivedBinaryMessage>();
          return 0;
        })
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<ReceivedBinaryMessage>();
        })
        .respond((message) => {
          expectTypeOf(message).toEqualTypeOf<ReceivedBinaryMessage>();
          return { type: 'a' };
        });

      expectTypeOf(restrictedHandler.messages[0].data).toEqualTypeOf<ReceivedBinaryMessage>();

      const binaryHandler = handler.with((message): message is ArrayBuffer => message instanceof ArrayBuffer);

      binaryHandler.effect((message) => {
        expectTypeOf(message).toEqualTypeOf<ArrayBuffer>();
      });

      expectTypeOf<(typeof binaryHandler.messages)[number]['data']>().toEqualTypeOf<ArrayBuffer>();
    }

    expectTypeOf(declareBinaryHandlers).toBeFunction();
  });

  it('should accept only whole binary values in static restrictions', () => {
    type BinarySchema = Blob | ArrayBuffer | { type: 'a'; id: string };

    function declareBinaryRestrictions(handler: LocalWebSocketMessageHandler<SinglePathSchema<BinarySchema>>) {
      handler.with(new Blob(['a']));
      handler.with(new ArrayBuffer(1));
      handler.with(new Uint8Array([1]));

      handler.with({ type: 'a' }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Extract<BinarySchema, { type: 'a' }>>();
      });

      handler.with({}).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Extract<BinarySchema, { type: 'a' }>>();
      });

      // @ts-expect-error Partial binary restriction.
      handler.with({ size: 1 });

      // @ts-expect-error Partial binary restriction.
      handler.with({ byteLength: 1 });
    }

    expectTypeOf(declareBinaryRestrictions).toBeFunction();
  });

  it('should receive top-level number and boolean schema members as text', () => {
    type PrimitiveSchema = number | boolean | { type: 'a' };
    type ReceivedPrimitiveMessage = `${number}` | 'true' | 'false' | Extract<PrimitiveSchema, { type: 'a' }>;

    function declarePrimitiveHandlers(handler: LocalWebSocketMessageHandler<SinglePathSchema<PrimitiveSchema>>) {
      const restrictedHandler = handler
        .with((message) => {
          expectTypeOf(message).toEqualTypeOf<ReceivedPrimitiveMessage>();
          return true;
        })
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<ReceivedPrimitiveMessage>();
        })
        .respond((message) => {
          expectTypeOf(message).toEqualTypeOf<ReceivedPrimitiveMessage>();
          return 1;
        });

      expectTypeOf(restrictedHandler.messages[0].data).toEqualTypeOf<ReceivedPrimitiveMessage>();

      const numberHandler = handler.with((message): message is `${number}` => !Number.isNaN(Number(message)));

      numberHandler.effect((message) => {
        expectTypeOf(message).toEqualTypeOf<`${number}`>();
      });

      expectTypeOf<(typeof numberHandler.messages)[number]['data']>().toEqualTypeOf<`${number}`>();
    }

    expectTypeOf(declarePrimitiveHandlers).toBeFunction();
  });

  it('should accept only the text of top-level number and boolean members in static restrictions', () => {
    type PrimitiveSchema = number | boolean | { type: 'a'; id: string };

    function declarePrimitiveRestrictions(
      handler: LocalWebSocketMessageHandler<SinglePathSchema<PrimitiveSchema>>,
      mixedText: '42' | 'true',
    ) {
      handler.with('42').effect((message) => {
        expectTypeOf(message).toEqualTypeOf<`${number}` | 'true' | 'false'>();
      });

      handler.with('true').effect((message) => {
        expectTypeOf(message).toEqualTypeOf<`${number}` | 'true' | 'false'>();
      });

      handler.with(mixedText).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<`${number}` | 'true' | 'false'>();
      });

      handler.with({ type: 'a' }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Extract<PrimitiveSchema, { type: 'a' }>>();
      });

      // @ts-expect-error Number restrictions accept only text.
      handler.with(42);

      // @ts-expect-error Boolean restrictions accept only text.
      handler.with(true);

      // @ts-expect-error Restriction text must match a schema member.
      handler.with('text');
    }

    expectTypeOf(declarePrimitiveRestrictions).toBeFunction();
  });

  it('should keep every text schema member through static text restrictions', () => {
    type TextSchema =
      | 'ping'
      | 'pong'
      | '41'
      | '40'
      | `42["user:delete",${JSONStringified<{ id: string }>}]`
      | `42["user:delete:success",${JSONStringified<{}>}]`;

    function declareStringRestrictions(
      handler: LocalWebSocketMessageHandler<SinglePathSchema<TextSchema>>,
      pingOrPong: 'ping' | 'pong',
    ) {
      const deleteHandler = handler.with(`42["user:delete",${JSON.stringify({ id: '1' })}]`);
      expectTypeOf(deleteHandler.messages[0].data).toEqualTypeOf<TextSchema>();

      const connectHandler = handler.with('40');
      expectTypeOf(connectHandler.messages[0].data).toEqualTypeOf<TextSchema>();

      handler.with('40', { exact: true }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<TextSchema>();
      });

      handler.with('ping').effect((message) => {
        expectTypeOf(message).toEqualTypeOf<TextSchema>();
      });

      handler.with(pingOrPong).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<TextSchema>();
      });

      handler
        .with((message): message is Extract<TextSchema, `42["user:delete",${string}]`> =>
          message.startsWith('42["user:delete",'),
        )
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<TextSchema, `42["user:delete",${string}]`>>();
        });

      // @ts-expect-error Restriction text must match a schema member.
      handler.with('text');
    }

    expectTypeOf(declareStringRestrictions).toBeFunction();
  });

  it('should narrow mixed string, JSON, and binary schemas through static restrictions', () => {
    type MixedSchema = string | { type: 'a' } | Blob;

    function declareMixedRestrictions(handler: LocalWebSocketMessageHandler<SinglePathSchema<MixedSchema>>) {
      handler.with('text').effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Extract<MixedSchema, string>>();
      });

      handler.with({ type: 'a' }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Extract<MixedSchema, { type: 'a' }>>();
      });

      handler.with(new Blob(['a'])).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<ArrayBuffer>();
      });
    }

    expectTypeOf(declareMixedRestrictions).toBeFunction();
  });

  it('should reject invalid message declarations', () => {
    function declareInvalidMessages(handler: LocalWebSocketMessageHandler<Schema>) {
      const restrictedHandler = handler
        .with({ type: 'create' })
        .with((message): message is CreateMessage => message.body.text.length > 0);

      // @ts-expect-error Invalid static restriction.
      handler.with({ type: 'update' });

      // @ts-expect-error Invalid static response.
      handler.respond({ type: 'update' });

      // @ts-expect-error Invalid computed response.
      handler.respond(() => ({ type: 'update' }));

      // @ts-expect-error Invalid restriction after narrowing.
      restrictedHandler.with({ type: 'delete' });

      // @ts-expect-error Invalid response after narrowing.
      restrictedHandler.respond({ type: 'update' });
    }

    expectTypeOf(declareInvalidMessages).toBeFunction();
  });
});
