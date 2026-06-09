import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import type { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import UnknownWebSocketInterceptorTypeError from '../../errors/UnknownWebSocketInterceptorTypeError';
import { createWebSocketInterceptor } from '../../factory';
import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor, WebSocketInterceptor } from '../../types/public';
import { InferWebSocketInterceptorSchema } from '../../types/schema';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

export function declareTypeWebSocketInterceptorTests(
  options: Omit<RuntimeSharedWebSocketInterceptorTestsOptions, 'getInterceptorOptions'>,
) {
  const { type, getBaseURL } = options;

  let baseURL: string;

  beforeEach(() => {
    baseURL = getBaseURL();
  });

  it('should infer local and remote factory return types', () => {
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

  it('should reject unknown interceptor types', () => {
    expect(() => {
      createWebSocketInterceptor<MessageSchema>({
        // @ts-expect-error Forcing an invalid interceptor type.
        type: 'unknown',
        baseURL,
      });
    }).toThrow(new UnknownWebSocketInterceptorTypeError('unknown'));
  });

  it('should expose public interceptor types', async () => {
    await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, (interceptor) => {
      expectTypeOf(interceptor).toExtend<WebSocketInterceptor<MessageSchema>>();
      expectTypeOf(interceptor.baseURL).toEqualTypeOf<string>();
      expectTypeOf(interceptor.messageSaving.enabled).toEqualTypeOf<boolean>();
      expectTypeOf(interceptor.server.messages).toEqualTypeOf<(typeof interceptor.clients)[number]['messages']>();
      expectTypeOf(interceptor.clients).toEqualTypeOf<(typeof interceptor.clients)[number][]>();
    });
  });

  it('should infer schemas from public interceptor types', () => {
    type LocalSchema = InferWebSocketInterceptorSchema<LocalWebSocketInterceptor<MessageSchema>>;
    expectTypeOf<LocalSchema>().toEqualTypeOf<MessageSchema>();

    type RemoteSchema = InferWebSocketInterceptorSchema<RemoteWebSocketInterceptor<MessageSchema>>;
    expectTypeOf<RemoteSchema>().toEqualTypeOf<MessageSchema>();

    type UnknownSchema = InferWebSocketInterceptorSchema<unknown>;
    expectTypeOf<UnknownSchema>().toEqualTypeOf<never>();
  });

  it('should expose local and remote sync return values', () => {
    const localInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'local', baseURL });
    expectTypeOf(localInterceptor.message).returns.toEqualTypeOf<LocalWebSocketMessageHandler<MessageSchema>>();
    expectTypeOf(localInterceptor.checkTimes).returns.toEqualTypeOf<void>();
    expectTypeOf(localInterceptor.clear).returns.toEqualTypeOf<void>();

    const remoteInterceptor = createWebSocketInterceptor<MessageSchema>({ type: 'remote', baseURL });
    expectTypeOf(remoteInterceptor.message).returns.toEqualTypeOf<RemoteWebSocketMessageHandler<MessageSchema>>();
    expectTypeOf(remoteInterceptor.checkTimes).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(remoteInterceptor.clear).returns.toEqualTypeOf<Promise<void>>();
  });

  it('should correctly type response and effect callbacks', async () => {
    await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, (interceptor) => {
      interceptor
        .message()
        .with({ type: 'create' })
        .respond((message, context) => {
          expectTypeOf(message).toEqualTypeOf<Extract<MessageSchema, { type: 'create' }>>();
          expectTypeOf(context.sender.messages).toEqualTypeOf<typeof context.receiver.messages>();

          return { type: 'delete', id: message.body.text };
        });

      interceptor.message().effect((message, context) => {
        expectTypeOf(message).toEqualTypeOf<MessageSchema>();
        expectTypeOf(context.receiver.send).toEqualTypeOf<typeof context.sender.send>();
      });

      // @ts-expect-error Invalid static restriction.
      interceptor.message().with({ type: 'update' });

      // @ts-expect-error Invalid static response.
      interceptor.message().respond({ type: 'update' });
    });
  });
}
