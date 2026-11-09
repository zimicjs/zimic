import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageSchema, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';
import { describe, expectTypeOf, it } from 'vitest';

import type {
  LocalWebSocketConnectionHandler,
  RemoteWebSocketConnectionHandler,
} from '@/ws/connectionHandler/types/public';
import type {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
} from '@/ws/interceptor/types/messages';
import type { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { createWebSocketInterceptor } from '../factory';
import { UnhandledMessageStrategy, WebSocketInterceptorType } from '../types/options';
import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor, WebSocketInterceptor } from '../types/public';
import { InferWebSocketInterceptorSchema } from '../types/schema';
import { declareWebSocketInterceptorTypes } from './shared/utils';

type Message = { type: 'create'; body: { text: string } } | { type: 'delete'; id: string };
type MessageSchema = WebSocketSchema<{ '/': { message: Message } }>;

type PathKeyedSchema = WebSocketSchema<{
  '/rooms/:roomId': { message: { type: 'chat'; text: string } };
  '/health': { message: { type: 'ping' } };
}>;

// The interceptors below are only type-checked. The functions declaring them are never called.
describe('WebSocketInterceptor > Types', () => {
  it('should type message handlers with the messages of the declared path', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      expectTypeOf(interceptor.message('/rooms/:roomId')).toEqualTypeOf<
        LocalWebSocketMessageHandler<WebSocketSchemaMessage<PathKeyedSchema, '/rooms/:roomId'>>
      >();

      expectTypeOf(interceptor.message('/rooms/1')).toEqualTypeOf<
        LocalWebSocketMessageHandler<WebSocketSchemaMessage<PathKeyedSchema, '/rooms/:roomId'>>
      >();
    }

    expectTypeOf(declareHandlers).toBeFunction();
  });

  it('should type message handlers with the messages of all paths if no path is declared', () => {
    function declareHandlers(interceptor: LocalWebSocketInterceptor<PathKeyedSchema>) {
      expectTypeOf(interceptor.message()).toEqualTypeOf<
        LocalWebSocketMessageHandler<WebSocketSchemaMessage<PathKeyedSchema>>
      >();
    }

    expectTypeOf(declareHandlers).toBeFunction();
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

  it('should correctly type local interceptors by default', () => {
    function declareInterceptor(baseURL: string) {
      const interceptor = createWebSocketInterceptor<MessageSchema>({ baseURL });

      expectTypeOf(interceptor.message).parameters.toEqualTypeOf<[path?: '/']>();
      expectTypeOf(interceptor.checkTimes).returns.toEqualTypeOf<void>();
      expectTypeOf(interceptor.clear).returns.toEqualTypeOf<void>();
    }

    expectTypeOf(declareInterceptor).toBeFunction();
  });

  it('should correctly type public interceptor types', () => {
    declareWebSocketInterceptorTypes<MessageSchema>((interceptor) => {
      expectTypeOf(interceptor).toExtend<WebSocketInterceptor<MessageSchema>>();
      expectTypeOf(interceptor.baseURL).toEqualTypeOf<string>();
      expectTypeOf(interceptor.messageSaving.enabled).toEqualTypeOf<boolean>();
      expectTypeOf(interceptor.connectionSaving.enabled).toEqualTypeOf<boolean>();
      expectTypeOf(interceptor.server).toEqualTypeOf<WebSocketInterceptorServer<Message>>();
      expectTypeOf(interceptor.clients).toEqualTypeOf<readonly WebSocketInterceptorClient<Message>[]>();
      expectTypeOf(interceptor.server.messages).toEqualTypeOf<
        readonly InterceptedWebSocketInterceptorMessage<Message>[]
      >();
      expectTypeOf(interceptor.server).not.toExtend<WebSocketInterceptorClient<Message>>();

      expectTypeOf(interceptor.message().from).parameter(0).toEqualTypeOf<WebSocketInterceptorClient<Message>>();

      function declareInvalidSender() {
        // @ts-expect-error Interceptor server handles cannot restrict client senders.
        interceptor.message().from(interceptor.server);
      }

      expectTypeOf(declareInvalidSender).toBeFunction();
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

  it('should correctly type local and remote sync return values', () => {
    function declareInterceptors(baseURL: string) {
      const localInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'local', baseURL });
      expectTypeOf(localInterceptor.message).returns.toEqualTypeOf<LocalWebSocketMessageHandler<Message>>();
      expectTypeOf(localInterceptor.connection).returns.toEqualTypeOf<
        LocalWebSocketConnectionHandler<MessageSchema, '/'>
      >();
      expectTypeOf(localInterceptor.connection).parameters.toEqualTypeOf<[path?: '/']>();
      expectTypeOf(localInterceptor.checkTimes).returns.toEqualTypeOf<void>();
      expectTypeOf(localInterceptor.clear).returns.toEqualTypeOf<void>();

      const remoteInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'remote', baseURL });
      expectTypeOf(remoteInterceptor.message).returns.toEqualTypeOf<RemoteWebSocketMessageHandler<Message>>();
      expectTypeOf(remoteInterceptor.connection).returns.toEqualTypeOf<
        RemoteWebSocketConnectionHandler<MessageSchema, '/'>
      >();
      expectTypeOf(remoteInterceptor.checkTimes).returns.toEqualTypeOf<Promise<void>>();
      expectTypeOf(remoteInterceptor.clear).returns.toEqualTypeOf<Promise<void>>();
    }

    expectTypeOf(declareInterceptors).toBeFunction();
  });

  it('should correctly type response and effect callbacks', () => {
    declareWebSocketInterceptorTypes<MessageSchema>((interceptor) => {
      interceptor
        .message()
        .with({ type: 'create' })
        .respond((message, context) => {
          expectTypeOf(message).toEqualTypeOf<Extract<Message, { type: 'create' }>>();
          expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<Message>>();
          expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorServer<Message>>();

          return { type: 'delete', id: message.body.text };
        });

      interceptor.message().effect((message, context) => {
        expectTypeOf(message).toEqualTypeOf<Message>();
        expectTypeOf(context.receiver.send).toEqualTypeOf<WebSocketInterceptorServer<Message>['send']>();
        expectTypeOf(context.sender.send).toEqualTypeOf<WebSocketInterceptorClient<Message>['send']>();
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

  describe('Unhandled messages', () => {
    it('should correctly type the unhandled message strategy', () => {
      function declareInterceptors(type: WebSocketInterceptorType, baseURL: string) {
        const interceptor: WebSocketInterceptor<MessageSchema> = createWebSocketInterceptor<MessageSchema>({
          type,
          baseURL,
        });
        expectTypeOf(interceptor.onUnhandledMessage).toEqualTypeOf<UnhandledMessageStrategy | undefined>();

        const localInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'local', baseURL });
        expectTypeOf(localInterceptor.onUnhandledMessage).toEqualTypeOf<UnhandledMessageStrategy | undefined>();

        const remoteInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'remote', baseURL });
        expectTypeOf(remoteInterceptor.onUnhandledMessage).toEqualTypeOf<UnhandledMessageStrategy | undefined>();
      }

      expectTypeOf(declareInterceptors).toBeFunction();

      expectTypeOf<UnhandledMessageStrategy.Declaration>().toEqualTypeOf<{ log?: boolean }>();
      expectTypeOf<UnhandledMessageStrategy.DeclarationFactory>().parameters.toEqualTypeOf<[WebSocketMessageSchema]>();
      expectTypeOf<UnhandledMessageStrategy.DeclarationFactory>().returns.toEqualTypeOf<
        PossiblePromise<UnhandledMessageStrategy.Declaration>
      >();

      function declareStrategies(baseURL: string) {
        createWebSocketInterceptor<MessageSchema>({ baseURL, onUnhandledMessage: { log: false } });
        createWebSocketInterceptor<MessageSchema>({ type: 'remote', baseURL, onUnhandledMessage: {} });
        createWebSocketInterceptor<MessageSchema>({ baseURL, onUnhandledMessage: () => ({ log: true }) });
        createWebSocketInterceptor<MessageSchema>({
          type: 'remote',
          baseURL,
          onUnhandledMessage: () => Promise.resolve({}),
        });

        // @ts-expect-error Unhandled messages have no action.
        createWebSocketInterceptor<MessageSchema>({ baseURL, onUnhandledMessage: { action: 'reject' } });

        // @ts-expect-error Unhandled message factories must return a declaration.
        createWebSocketInterceptor<MessageSchema>({ baseURL, onUnhandledMessage: () => true });
      }

      expectTypeOf(declareStrategies).toBeFunction();
    });
  });
});
