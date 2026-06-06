---
title: Using WebSocket interceptors | @zimic/interceptor
sidebar_label: Using WebSocket interceptors
slug: /interceptor/guides/ws/interceptors
---

# Using WebSocket interceptors

:::warning EXPERIMENTAL

WebSocket interceptors are available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming
stable.

:::

WebSocket interceptors let tests handle real WebSocket clients with typed message handlers. They support local and
remote modes, connected client tracking, server-to-client sends, declarative message matching, effects, responses, saved
client-to-server messages, and `.times()` assertions.

## Creating an interceptor

Declare a WebSocket schema with `@zimic/ws`, then create an interceptor with a `ws` or `wss` base URL.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{ type: 'ping'; data: { id: string } } | { type: 'pong'; data: { id: string } }>;

const interceptor = createWebSocketInterceptor<Schema>({
  type: 'local',
  baseURL: 'ws://localhost:3000',
  messageSaving: { enabled: true },
});
```

Remote WebSocket interceptors use the same interceptor server as remote HTTP interceptors. When multiple remote
interceptors share a server, use a unique path discriminator in each `baseURL`.

```ts
const interceptor = createWebSocketInterceptor<Schema>({
  type: 'remote',
  baseURL: `ws://localhost:3000/chat/${crypto.randomUUID()}`,
});
```

## Handling messages

Start the interceptor before declaring handlers or opening clients. Creating a `message()` handler activates
interception for the base URL.

```ts
beforeAll(async () => {
  await interceptor.start();
});

beforeEach(async () => {
  await interceptor.clear();
});

afterEach(async () => {
  await interceptor.checkTimes();
});

afterAll(async () => {
  await interceptor.stop();
});
```

Use `.with(...)` to match message data and `.respond(...)` to send a response to the client that sent the message.

```ts
interceptor
  .message()
  .with({ type: 'ping' })
  .respond((message) => ({
    type: 'pong',
    data: { id: message.data.id },
  }))
  .times(1);
```

Declarationless handlers are valid passive handlers. They accept connections, observe matching messages, save them when
message saving is enabled, and count toward `.times()` without sending a response or running an effect.

```ts
const handler = interceptor.message().with({ type: 'ping' }).times(1);

// Run the application and send a WebSocket message...

expect(handler.messages).toHaveLength(1);
```

The interceptor also exposes connected clients and a synthetic server handle. Calling `interceptor.server.send(...)`
broadcasts to currently connected clients.

```ts
interceptor.server.send(JSON.stringify({ type: 'pong', data: { id: '1' } }));
```

Server-originated broadcasts are delivered to connected clients, but they are not added to handler or client saved
message lists. Saved messages are produced by matched client-to-server messages.

## Scope

WebSocket interceptors are designed for typed test and development mocks. They do not proxy unmatched WebSocket traffic
to an upstream server, and they do not provide a general-purpose WebSocket gateway. Declare handlers for the messages
your test expects to observe or mock.
