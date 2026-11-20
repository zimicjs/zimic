import { WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';
import msgpackParser from 'socket.io-msgpack-parser';
import * as defaultParser from 'socket.io-parser';
import { describe, expectTypeOf, it } from 'vitest';

import { createHttpInterceptor } from '@/http';
import { createWebSocketInterceptor } from '@/ws/interceptor/factory';
import type { WebSocketInterceptorProtocol } from '@/ws/interceptor/types/protocol';

import { createSocketIOProtocol } from '../factory';
import type { SocketIOMessage } from '../types/messages';
import type { SocketIOParser } from '../types/options';
import type { SocketIOPollingSchema } from '../types/polling';
import type { SocketIOSchema } from '../types/schema';

/* eslint-disable @typescript-eslint/naming-convention -- Socket.IO event names commonly use colons. */
interface ServerToClientEvents {
  'user:created': (user: { id: string }) => void;
}

interface ClientToServerEvents {
  'user:create': (input: { name: string }, ack: (user: { id: string }, source: string) => void) => void;
  'user:notify': (input: { name: string }, priority: number) => void;
}

interface ArgumentlessEvents {
  'user:ping': () => void;
}

interface ArgumentlessAckEvents {
  'user:delete': (id: string, ack: () => void) => void;
}

interface SingleArgumentAckEvents {
  'user:find': (id: string, ack: (user: { id: string }) => void) => void;
}

interface OptionalAckEvents {
  'user:update': (id: string, ack?: () => void) => void;
}
/* eslint-enable @typescript-eslint/naming-convention */

type ChatMessage = WebSocketSchemaMessage<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>;

describe('SocketIOProtocol > Types', () => {
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

  it('should type events without arguments with no data or args', () => {
    type Message = WebSocketSchemaMessage<SocketIOSchema<ArgumentlessEvents, object>>;

    expectTypeOf<Message['data']>().toEqualTypeOf<undefined>();
    expectTypeOf<Message>().not.toHaveProperty('args');
  });

  it('should type events of default event maps with unknown arguments', () => {
    type Message = Extract<WebSocketSchemaMessage<SocketIOSchema>, { type: string }>;

    expectTypeOf<Message['type']>().toEqualTypeOf<string>();
    expectTypeOf<Message['data']>().toEqualTypeOf<unknown>();
    expectTypeOf<Message['args']>().toEqualTypeOf<unknown[] | undefined>();
  });

  it('should derive acks from the event callback parameters', () => {
    type Ack = Exclude<ChatMessage, { type: string }>;

    expectTypeOf<Ack['ackId']>().toEqualTypeOf<number>();
    expectTypeOf<Ack['data']>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<Ack['args']>().toEqualTypeOf<[string]>();
  });

  it('should type acks without arguments with no data or args', () => {
    type Ack = Exclude<WebSocketSchemaMessage<SocketIOSchema<object, ArgumentlessAckEvents>>, { type: string }>;

    expectTypeOf<Ack['ackId']>().toEqualTypeOf<number>();
    expectTypeOf<Ack['data']>().toEqualTypeOf<undefined>();
    expectTypeOf<Ack>().not.toHaveProperty('args');
  });

  it('should type acks with one argument as data without args', () => {
    type Ack = Exclude<WebSocketSchemaMessage<SocketIOSchema<object, SingleArgumentAckEvents>>, { type: string }>;

    expectTypeOf<Ack['data']>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<Ack>().not.toHaveProperty('args');
  });

  it('should require the ack ID of events with a required ack callback', () => {
    type Message = Extract<ChatMessage, { type: 'user:create' }>;

    expectTypeOf<Message['ackId']>().toEqualTypeOf<number>();
  });

  it('should make the ack ID of events with an optional ack callback optional', () => {
    type Message = Extract<WebSocketSchemaMessage<SocketIOSchema<object, OptionalAckEvents>>, { type: string }>;

    expectTypeOf<Message['data']>().toEqualTypeOf<string>();
    expectTypeOf<Message['ackId']>().toEqualTypeOf<number | undefined>();
  });

  it('should not declare the ack ID of events without an ack callback', () => {
    type Message = Extract<ChatMessage, { type: 'user:notify' }>;

    expectTypeOf<Message>().not.toHaveProperty('ackId');
  });

  it('should make the ack ID of client events of default event maps optional', () => {
    type Message = Extract<WebSocketSchemaMessage<SocketIOSchema<object>>, { type: string }>;

    expectTypeOf<Message['ackId']>().toEqualTypeOf<number | undefined>();
  });

  it('should acknowledge events with a required ack callback without asserting their ack ID', () => {
    function declareHandler() {
      const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });

      interceptor
        .message()
        .with({ type: 'user:create' })
        .respond((message) => ({ ackId: message.ackId, data: { id: '1' }, args: ['server'] }));
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should not accept events with data that does not match the event', () => {
    function sendMessage() {
      const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });

      // @ts-expect-error The data of `user:created` is a user.
      interceptor.server.send({ type: 'user:created', data: 'user' });
    }

    expectTypeOf(sendMessage).toBeFunction();
  });

  it('should not accept events that are not declared in the schema', () => {
    function sendMessage() {
      const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });

      // @ts-expect-error `user:deleted` is not an event of the schema.
      interceptor.server.send({ type: 'user:deleted', data: { id: '1' } });
    }

    expectTypeOf(sendMessage).toBeFunction();
  });

  it('should not accept acks with arguments that do not match the ack callback', () => {
    function sendMessage() {
      const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });

      // @ts-expect-error The `user:create` ack callback receives a source as its second argument.
      interceptor.server.send({ ackId: 1, data: { id: '1' } });
    }

    expectTypeOf(sendMessage).toBeFunction();
  });

  it('should not accept ack IDs in server events', () => {
    function sendMessage() {
      const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });

      // @ts-expect-error Server events do not expect acknowledgements from clients.
      interceptor.server.send({ type: 'user:created', data: { id: '1' }, ackId: 1 });
    }

    expectTypeOf(sendMessage).toBeFunction();
  });

  it('should type client auth from the schema', () => {
    function declareHandler() {
      const interceptor = createWebSocketInterceptor<
        SocketIOSchema<ServerToClientEvents, ClientToServerEvents, { token: string }>
      >({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });

      interceptor.connection().effect((client) => {
        expectTypeOf(client.auth).toEqualTypeOf<{ token: string }>();
      });
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should type connection auth restrictions from the schema', () => {
    function declareHandler() {
      const interceptor = createWebSocketInterceptor<
        SocketIOSchema<ServerToClientEvents, ClientToServerEvents, { token: string; user: { id: string } }>
      >({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });

      interceptor.connection().with({ auth: { user: {} } });

      // @ts-expect-error The auth token is declared as a string.
      interceptor.connection().with({ auth: { token: 1 } });
    }

    expectTypeOf(declareHandler).toBeFunction();
  });

  it('should accept the default parser and socket.io-msgpack-parser as parsers', () => {
    expectTypeOf(defaultParser).toExtend<SocketIOParser>();
    expectTypeOf(msgpackParser).toExtend<SocketIOParser>();
  });

  it('should accept local and remote HTTP interceptors of the polling schema as polling interceptors', () => {
    function createProtocols() {
      createSocketIOProtocol({
        polling: createHttpInterceptor<SocketIOPollingSchema>({
          type: 'local',
          baseURL: 'http://localhost:3000/socket.io',
        }),
      });

      createSocketIOProtocol({
        polling: createHttpInterceptor<SocketIOPollingSchema>({
          type: 'remote',
          baseURL: 'http://localhost:3000/socket.io',
        }),
      });
    }

    expectTypeOf(createProtocols).toBeFunction();
  });

  it('should create WebSocket interceptor protocols', () => {
    expectTypeOf(createSocketIOProtocol()).toExtend<WebSocketInterceptorProtocol<SocketIOMessage>>();
    expectTypeOf(createSocketIOProtocol<ChatMessage>()).toExtend<WebSocketInterceptorProtocol<ChatMessage>>();
  });

  it('should accept Socket.IO protocols in interceptors of Socket.IO schemas', () => {
    function createInterceptor() {
      createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
        baseURL: 'ws://localhost:3000/socket.io',
        protocol: createSocketIOProtocol(),
      });
    }

    expectTypeOf(createInterceptor).toBeFunction();
  });

  it('should not accept Socket.IO protocols in interceptors of other schemas', () => {
    type JSONSchema = WebSocketSchema<{ '/': { message: { text: string } } }>;

    function createInterceptor() {
      createWebSocketInterceptor<JSONSchema>({
        baseURL: 'ws://localhost:3000/socket.io',
        // @ts-expect-error Socket.IO protocols translate only Socket.IO messages.
        protocol: createSocketIOProtocol(),
      });
    }

    expectTypeOf(createInterceptor).toBeFunction();
  });
});
