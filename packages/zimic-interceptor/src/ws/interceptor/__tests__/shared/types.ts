import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expectTypeOf, it } from 'vitest';

import type {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
  WebSocketInterceptorServerSendOptions,
} from '@/ws/interceptor/types/messages';
import type { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { createWebSocketInterceptor } from '../../factory';
import { UnhandledMessageStrategy } from '../../types/options';
import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor, WebSocketInterceptor } from '../../types/public';
import { InferWebSocketInterceptorSchema } from '../../types/schema';
import { declareWebSocketInterceptorTypes, RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

export function declareTypeWebSocketInterceptorTests(
  options: Omit<RuntimeSharedWebSocketInterceptorTestsOptions, 'getInterceptorOptions'>,
) {
  const { type, getBaseURL } = options;

  let baseURL: string;

  beforeEach(() => {
    baseURL = getBaseURL();
  });

  it('should correctly type local and remote factory return values', () => {
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
  });

  if (type === 'local') {
    it('should correctly type local interceptors by default', () => {
      const interceptor = createWebSocketInterceptor<MessageSchema>({ baseURL });

      expectTypeOf(interceptor.message).parameters.toEqualTypeOf<[]>();
      expectTypeOf(interceptor.checkTimes).returns.toEqualTypeOf<void>();
      expectTypeOf(interceptor.clear).returns.toEqualTypeOf<void>();
    });
  }

  it('should correctly type public interceptor types', () => {
    declareWebSocketInterceptorTypes<MessageSchema>((interceptor) => {
      expectTypeOf(interceptor).toExtend<WebSocketInterceptor<MessageSchema>>();
      expectTypeOf(interceptor.baseURL).toEqualTypeOf<string>();
      expectTypeOf(interceptor.messageSaving.enabled).toEqualTypeOf<boolean>();
      expectTypeOf(interceptor.server).toEqualTypeOf<WebSocketInterceptorServer<MessageSchema>>();
      expectTypeOf(interceptor.clients).toEqualTypeOf<readonly WebSocketInterceptorClient<MessageSchema>[]>();
      expectTypeOf(interceptor.server.messages).toEqualTypeOf<
        readonly InterceptedWebSocketInterceptorMessage<MessageSchema>[]
      >();
      expectTypeOf(interceptor.server).not.toExtend<WebSocketInterceptorClient<MessageSchema>>();
      expectTypeOf<(typeof interceptor.clients)[number]>().not.toExtend<WebSocketInterceptorServer<MessageSchema>>();

      expectTypeOf(interceptor.message().from).parameter(0).toEqualTypeOf<WebSocketInterceptorClient<MessageSchema>>();

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
    const localInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'local', baseURL });
    expectTypeOf(localInterceptor.message).returns.toEqualTypeOf<LocalWebSocketMessageHandler<MessageSchema>>();
    expectTypeOf(localInterceptor.checkTimes).returns.toEqualTypeOf<void>();
    expectTypeOf(localInterceptor.clear).returns.toEqualTypeOf<void>();

    const remoteInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'remote', baseURL });
    expectTypeOf(remoteInterceptor.message).returns.toEqualTypeOf<RemoteWebSocketMessageHandler<MessageSchema>>();
    expectTypeOf(remoteInterceptor.checkTimes).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(remoteInterceptor.clear).returns.toEqualTypeOf<Promise<void>>();
  });

  it('should correctly type response and effect callbacks', () => {
    declareWebSocketInterceptorTypes<MessageSchema>((interceptor) => {
      interceptor
        .message()
        .with({ type: 'create' })
        .respond((message, context) => {
          expectTypeOf(message).toEqualTypeOf<Extract<MessageSchema, { type: 'create' }>>();
          expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<MessageSchema>>();
          expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorServer<MessageSchema>>();

          return { type: 'delete', id: message.body.text };
        });

      interceptor.message().effect((message, context) => {
        expectTypeOf(message).toEqualTypeOf<MessageSchema>();
        expectTypeOf(context.receiver.send).parameter(0).toEqualTypeOf<Parameters<typeof context.sender.send>[0]>();
        expectTypeOf(context.receiver.send)
          .parameter(1)
          .toEqualTypeOf<WebSocketInterceptorServerSendOptions<MessageSchema> | undefined>();
        expectTypeOf(context.receiver.send).toEqualTypeOf<WebSocketInterceptorServer<MessageSchema>['send']>();
        expectTypeOf(context.sender.send).toEqualTypeOf<WebSocketInterceptorClient<MessageSchema>['send']>();
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
      const interceptor: WebSocketInterceptor<MessageSchema> = createWebSocketInterceptor<MessageSchema>({
        type,
        baseURL,
      });
      expectTypeOf(interceptor.onUnhandledMessage).toEqualTypeOf<UnhandledMessageStrategy | undefined>();

      const localInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'local', baseURL });
      expectTypeOf(localInterceptor.onUnhandledMessage).toEqualTypeOf<UnhandledMessageStrategy | undefined>();

      const remoteInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'remote', baseURL });
      expectTypeOf(remoteInterceptor.onUnhandledMessage).toEqualTypeOf<UnhandledMessageStrategy | undefined>();

      expectTypeOf<UnhandledMessageStrategy.Declaration>().toEqualTypeOf<{ log?: boolean }>();
      expectTypeOf<UnhandledMessageStrategy.DeclarationFactory>().parameters.toEqualTypeOf<[WebSocketSchema]>();
      expectTypeOf<UnhandledMessageStrategy.DeclarationFactory>().returns.toEqualTypeOf<
        PossiblePromise<UnhandledMessageStrategy.Declaration>
      >();

      function declareStrategies() {
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
}
