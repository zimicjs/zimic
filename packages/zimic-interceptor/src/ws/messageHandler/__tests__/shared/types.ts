import { WebSocketSchema } from '@zimic/ws';
import { expectTypeOf, it } from 'vitest';

import {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
} from '../../../interceptor/types/messages';
import type {
  LocalWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler,
  SyncedRemoteWebSocketMessageHandler,
} from '../../types/public';
import { Schema } from './utils';

type CreateMessage = Extract<Schema, { type: 'create' }>;
type PrioritizedCreateMessage = CreateMessage & {
  body: CreateMessage['body'] & { priority: number };
};

type NestedSchema = WebSocketSchema<
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
  | { type: 'delete'; id: string }
>;

// The handlers below are only type-checked. The functions declaring them are never called.
export function declareTypeWebSocketMessageHandlerTests() {
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
    function declarePartialStaticRestrictions(handler: LocalWebSocketMessageHandler<NestedSchema>) {
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
    function declareLocalClear(handler: LocalWebSocketMessageHandler<Schema, CreateMessage>) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<LocalWebSocketMessageHandler<Schema, Schema>>();

      clearedHandler
        .with({ type: 'delete' })
        .delay((message) => message.id.length)
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<Schema, { type: 'delete' }>>();
        })
        .respond({ type: 'create', body: { text: 'response' } })
        .times(1);
    }

    function declarePendingRemoteClear(handler: PendingRemoteWebSocketMessageHandler<Schema, CreateMessage>) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<PendingRemoteWebSocketMessageHandler<Schema, Schema>>();

      clearedHandler.respond({ type: 'delete', id: '1' }).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Schema>();
      });
    }

    async function declareSyncedRemoteClear(handler: SyncedRemoteWebSocketMessageHandler<Schema, CreateMessage>) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<PendingRemoteWebSocketMessageHandler<Schema, Schema>>();

      const syncedHandler = await clearedHandler;
      expectTypeOf(syncedHandler).toEqualTypeOf<SyncedRemoteWebSocketMessageHandler<Schema, Schema>>();
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
        readonly InterceptedWebSocketInterceptorMessage<PrioritizedCreateMessage, Schema>[]
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

      function isCreateMessage(message: Schema): message is CreateMessage {
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
          expectTypeOf(message).toEqualTypeOf<Schema>();
        });
    }

    expectTypeOf(declareBooleanRestriction).toBeFunction();
  });

  it('should receive binary schema members as ArrayBuffer', () => {
    type BinarySchema = WebSocketSchema<Blob | { type: 'a' }>;
    type ReceivedBinaryMessage = ArrayBuffer | Extract<BinarySchema, { type: 'a' }>;

    function declareBinaryHandlers(handler: LocalWebSocketMessageHandler<BinarySchema>) {
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
    type BinarySchema = WebSocketSchema<Blob | ArrayBuffer | { type: 'a'; id: string }>;

    function declareBinaryRestrictions(handler: LocalWebSocketMessageHandler<BinarySchema>) {
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
    type PrimitiveSchema = WebSocketSchema<number | boolean | { type: 'a' }>;
    type ReceivedPrimitiveMessage = `${number}` | 'true' | 'false' | Extract<PrimitiveSchema, { type: 'a' }>;

    function declarePrimitiveHandlers(handler: LocalWebSocketMessageHandler<PrimitiveSchema>) {
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
    type PrimitiveSchema = WebSocketSchema<number | boolean | { type: 'a'; id: string }>;

    function declarePrimitiveRestrictions(
      handler: LocalWebSocketMessageHandler<PrimitiveSchema>,
      mixedText: '42' | 'true',
    ) {
      handler.with('42').effect((message) => {
        expectTypeOf(message).toEqualTypeOf<`${number}`>();
      });

      handler.with('true').effect((message) => {
        expectTypeOf(message).toEqualTypeOf<'true'>();
      });

      handler.with(mixedText).effect((message) => {
        expectTypeOf(message).toEqualTypeOf<`${number}` | 'true'>();
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
}
