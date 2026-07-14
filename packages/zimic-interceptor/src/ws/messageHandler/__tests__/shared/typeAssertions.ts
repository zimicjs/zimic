import { WebSocketSchema } from '@zimic/ws';
import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
} from '../../../interceptor/types/messages';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import type {
  LocalWebSocketMessageHandler as PublicLocalWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler,
  SyncedRemoteWebSocketMessageHandler,
} from '../../types/public';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

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

export function declareTypeAssertionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, startServer, stopServer, getBaseURL } = options;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should narrow message schemas through static restrictions', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      function effect(message: Extract<Schema, { type: 'create' }>) {
        expectTypeOf(message).toEqualTypeOf<Extract<Schema, { type: 'create' }>>();
        expectTypeOf(message.body.text).toEqualTypeOf<string>();
      }

      effect({ type: 'create', body: { text: 'hello' } });

      interceptor.message().with({ type: 'create' }).effect(effect);
    });
  });

  it('should narrow compatible union members through partial static restrictions', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<NestedSchema>({ type, baseURL }, async (interceptor) => {
      const nestedHandler = interceptor.message().with({ body: { text: 'hello' } });

      nestedHandler.effect(
        /* istanbul ignore next -- @preserve
         * This callback exists only to assert its inferred parameter type. */
        (message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<NestedSchema, { body: { text: string } }>>();
        },
      );

      const optionalHandler = interceptor.message().with({ body: { details: { priority: 1 } } });

      optionalHandler.effect(
        /* istanbul ignore next -- @preserve
         * This callback exists only to assert its inferred parameter type. */
        (message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<NestedSchema, { body: { text: string } }>>();
        },
      );

      const chainedHandler = interceptor
        .message()
        .with({ type: 'create' })
        .with({ body: { count: 1 } });

      chainedHandler.effect(
        /* istanbul ignore next -- @preserve
         * This callback exists only to assert its inferred parameter type. */
        (message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<NestedSchema, { body: { count: number } }>>();
        },
      );

      await Promise.all([nestedHandler, optionalHandler, chainedHandler]);
    });
  });

  it('should reset cleared handler return types to the root schema', () => {
    /* istanbul ignore next -- @preserve
     * This declaration exists only for compile-time assertions and cannot run without mutating a live handler. */
    function declareLocalClear(handler: PublicLocalWebSocketMessageHandler<Schema, CreateMessage>) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<PublicLocalWebSocketMessageHandler<Schema, Schema>>();

      clearedHandler
        .with({ type: 'delete' })
        .delay(
          /* istanbul ignore next -- @preserve
           * This callback belongs to a compile-only handler declaration. */
          (message) => message.id.length,
        )
        .effect(
          /* istanbul ignore next -- @preserve
           * This callback belongs to a compile-only handler declaration. */
          (message) => {
            expectTypeOf(message).toEqualTypeOf<Extract<Schema, { type: 'delete' }>>();
          },
        )
        .respond({ type: 'create', body: { text: 'response' } })
        .times(1);
    }

    /* istanbul ignore next -- @preserve
     * This declaration exists only for compile-time assertions and cannot run without mutating a live handler. */
    function declarePendingRemoteClear(handler: PendingRemoteWebSocketMessageHandler<Schema, CreateMessage>) {
      const clearedHandler = handler.clear();
      expectTypeOf(clearedHandler).toEqualTypeOf<PendingRemoteWebSocketMessageHandler<Schema, Schema>>();
      clearedHandler.respond({ type: 'delete', id: '1' }).effect(
        /* istanbul ignore next -- @preserve
         * This callback belongs to a compile-only handler declaration. */
        (message) => {
          expectTypeOf(message).toEqualTypeOf<Schema>();
        },
      );
    }

    /* istanbul ignore next -- @preserve
     * This declaration exists only for compile-time assertions and cannot run without mutating a live handler. */
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

  it('should preserve the root schema while chaining static and computed restrictions', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      function hasPriority(message: CreateMessage): message is PrioritizedCreateMessage {
        return message.body.priority !== undefined;
      }

      expect(hasPriority({ type: 'create', body: { text: 'hello', priority: 1 } })).toBe(true);
      expect(hasPriority({ type: 'create', body: { text: 'hello' } })).toBe(false);

      const pendingHandler = interceptor.message().with({ type: 'create' });
      const syncedHandler = await pendingHandler;
      const handler = syncedHandler.with(hasPriority);

      handler.delay((message) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        return message.body.priority;
      });

      handler.effect((message, context) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
        expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorServer<Schema>>();

        context.sender.send(JSON.stringify({ type: 'delete', id: message.body.text }));
        context.receiver.send(JSON.stringify({ type: 'create', body: { text: 'response' } }));
      });

      handler.respond((message, context) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<Schema>>();
        expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorServer<Schema>>();

        return { type: 'delete', id: message.body.text };
      });

      handler.respond({ type: 'delete', id: '1' });

      expectTypeOf<typeof handler.messages>().toEqualTypeOf<
        readonly InterceptedWebSocketInterceptorMessage<PrioritizedCreateMessage, Schema>[]
      >();

      await handler;
    });
  });

  it('should accept boolean computed restrictions without narrowing message schemas', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      const handler = interceptor.message().with((message): boolean => message.type === 'create');

      handler.effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Schema>();
      });
    });
  });

  it('should reject invalid message declarations', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      function responseFactory(message: Schema) {
        expectTypeOf(message).toEqualTypeOf<Schema>();

        return message;
      }
      responseFactory({ type: 'delete', id: '1' });
      interceptor.message().respond(responseFactory);

      /* istanbul ignore next -- @preserve
       * Invalid declarations must remain compile-only to avoid registering them on a live remote interceptor. */
      function invalidResponseFactory() {
        return { type: 'update' };
      }
      /* istanbul ignore next -- @preserve
       * Invalid declarations must remain compile-only to avoid registering them on a live remote interceptor. */
      function declareInvalidResponseFactory() {
        // @ts-expect-error Invalid computed response.
        interceptor.message().respond(invalidResponseFactory);
      }

      const restrictedHandler = interceptor
        .message()
        .with({ type: 'create' })
        .with((message): message is CreateMessage => {
          return message.body.text.length > 0;
        });

      restrictedHandler.respond({ type: 'delete', id: '1' });

      /* istanbul ignore next -- @preserve
       * Invalid declarations must remain compile-only to avoid registering them on a live remote interceptor. */
      function declareInvalidMessages() {
        // @ts-expect-error Invalid static restriction.
        interceptor.message().with({ type: 'update' });

        // @ts-expect-error Invalid static response.
        interceptor.message().respond({ type: 'update' });

        // @ts-expect-error Invalid restriction after narrowing.
        restrictedHandler.with({ type: 'delete' });

        // @ts-expect-error Invalid response after narrowing.
        restrictedHandler.respond({ type: 'update' });
      }

      expectTypeOf(declareInvalidMessages).toBeFunction();
      expectTypeOf(declareInvalidResponseFactory).toBeFunction();
    });
  });
}
