import { WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';
import { describe, expectTypeOf, it } from 'vitest';

import { createWebSocketInterceptor } from '@/ws/interceptor/factory';

import { createSocketIOProtocol } from '../createSocketIOProtocol';
import type { SocketIOSchema } from '../types';

/* eslint-disable @typescript-eslint/naming-convention -- Socket.IO event names commonly use colons. */
interface ServerToClientEvents {
  'user:created': (user: { id: string }) => void;
}

interface ClientToServerEvents {
  'user:create': (input: { name: string }, ack: (user: { id: string }, source: string) => void) => void;
  'user:notify': (input: { name: string }, priority: number) => void;
}
/* eslint-enable @typescript-eslint/naming-convention */

type ChatMessage = WebSocketSchemaMessage<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>;

describe('SocketIOProtocol (types)', () => {
  it('should type the first argument of an event as data', () => {
    type Message = Extract<ChatMessage, { type: 'user:created' }>;

    expectTypeOf<Message['data']>().toEqualTypeOf<{ id: string }>();
  });

  it('should exclude the ack callback from the arguments of an event', () => {
    type Message = Extract<ChatMessage, { type: 'user:create' }>;

    expectTypeOf<Message['data']>().toEqualTypeOf<{ name: string }>();
    expectTypeOf<Message>().not.toHaveProperty('args');
  });

  it('should type the remaining arguments of an event as args', () => {
    type Message = Extract<ChatMessage, { type: 'user:notify' }>;

    expectTypeOf<Message['args']>().toEqualTypeOf<[number]>();
  });

  it('should derive acks from the event callback parameters', () => {
    type Ack = Exclude<ChatMessage, { type: string }>;

    expectTypeOf<Ack['ackId']>().toEqualTypeOf<number>();
    expectTypeOf<Ack['data']>().toEqualTypeOf<{ id: string } | undefined>();
    expectTypeOf<Ack['args']>().toEqualTypeOf<[string]>();
  });

  it('should accept Socket.IO protocols in interceptors of Socket.IO schemas', () => {
    function createInterceptor() {
      createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
        baseURL: 'ws://localhost:3000',
        protocol: createSocketIOProtocol(),
      });
    }

    expectTypeOf(createInterceptor).toBeFunction();
  });

  it('should not accept Socket.IO protocols in interceptors of other schemas', () => {
    type JSONSchema = WebSocketSchema<{ '/': { message: { text: string } } }>;

    function createInterceptor() {
      createWebSocketInterceptor<JSONSchema>({
        baseURL: 'ws://localhost:3000',
        // @ts-expect-error Socket.IO protocols translate only Socket.IO messages.
        protocol: createSocketIOProtocol(),
      });
    }

    expectTypeOf(createInterceptor).toBeFunction();
  });
});
