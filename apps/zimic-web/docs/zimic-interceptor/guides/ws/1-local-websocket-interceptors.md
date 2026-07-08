---
title: Using local WebSocket interceptors | @zimic/interceptor
sidebar_label: Using local interceptors
slug: /interceptor/guides/ws/local-interceptors
---

# Using local WebSocket interceptors

:::warning EXPERIMENTAL

WebSocket interceptors are available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming
stable.

:::

WebSocket interceptors allow you to handle client messages and send custom server messages. Their primary use is to mock
WebSocket flows in development or testing environments, especially when the backend is unavailable or when you want to
control connection and message scenarios.

In `@zimic/interceptor`, WebSocket interceptors are available in two types: `local` (default) and `remote`. When an
interceptor is `local`, Zimic intercepts WebSocket connections _in the same process_ as your application. This is the
simplest way to start mocking WebSocket messages and does not require any interceptor server setup.

## When to use local WebSocket interceptors

- **Development**

  Local interceptors are useful if you want to quickly mock WebSocket messages for a single application in development,
  especially when the backend is not yet ready or when you want to test different connection and message scenarios
  without relying on a real server.

- **Testing**

  If you run your application in the same process as your tests, local interceptors are a good way to mock WebSocket
  messages and verify how your application handles server responses, broadcasts, and connection state. This is common
  when using unit and integration test runners such as [Jest](https://jestjs.io) and [Vitest](https://vitest.dev).

## Creating a local WebSocket interceptor

To start using a WebSocket interceptor, declare a WebSocket schema using [`@zimic/ws`](/docs/ws/guides/schemas). The
schema represents the message data sent and received by your WebSocket clients and servers.

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type ChatMessage =
  | { type: 'message'; data: { text: string } }
  | { type: 'typing'; data: { username: string } }
  | { type: 'presence'; data: { online: boolean } };

type Schema = WebSocketSchema<ChatMessage>;
```

With the schema defined, you can now create your interceptor with `createWebSocketInterceptor`. It takes the schema as a
type parameter and returns an interceptor instance. The `baseURL` option represents the scope of the interceptor and
points to the URL that your application will use to open WebSocket connections. Local WebSocket interceptors are the
default, so `type: 'local'` is optional.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

const interceptor = createWebSocketInterceptor<Schema>({
  // highlight-next-line
  type: 'local', // optional
  baseURL: 'ws://localhost:3000/chat',
  messageSaving: { enabled: true },
});
```

You can also set other options, such as the interceptor type and message saving.

:::info INFO: <span>WebSocket interceptor scope</span>

WebSocket interceptors are designed for typed test and development mocks. They do not proxy unmatched WebSocket traffic
to an upstream server, and they do not provide a general-purpose WebSocket gateway. Declare handlers for the messages
your test expects to observe or mock.

:::

## WebSocket interceptor lifecycle

### Starting an interceptor

To intercept connections and messages, an interceptor must be started with `interceptor.start()`. This is usually done
in a `beforeAll` hook in your test suite.

```ts
beforeAll(async () => {
  // highlight-next-line
  await interceptor.start();
});
```

Start the interceptor before declaring handlers or opening clients. Creating a `message()` handler activates
interception for the interceptor `baseURL`.

:::info INFO: <span>Local interceptors in browsers</span>

If you are using a local WebSocket interceptor in a **browser** environment, you must first
[initialize a mock service worker](/docs/interceptor/cli/browser#zimic-interceptor-browser-init) in your public
directory before starting the interceptor.

:::

### Clearing an interceptor

When using an interceptor in tests, it's important to clear it between tests to avoid one test affecting another. This
is done with `interceptor.clear()`, which resets handlers, saved messages, connected clients, and server messages to
their initial states.

```ts
beforeEach(() => {
  // highlight-next-line
  interceptor.clear();
});
```

### Checking expectations

After each test, you can check if your application has sent all of the expected messages with
`interceptor.checkTimes()`.

```ts
afterEach(() => {
  // highlight-next-line
  interceptor.checkTimes();
});
```

### Stopping an interceptor

After the interceptor is no longer needed, such as at the end of your test suite, you can stop it with
`interceptor.stop()`.

```ts
afterAll(async () => {
  // highlight-next-line
  await interceptor.stop();
});
```

### Mocking messages

You can now use the interceptor to handle client-to-server messages and send mock server responses. Message data,
restrictions, responses, saved messages, connected clients, and server sends are typed by default based on the schema.

Use `interceptor.message()` to create a message handler. Handlers can restrict matching messages with `.with(...)`,
restrict messages to a known client with `.from(...)`, delay matching with `.delay(...)`, run side effects with
`.effect(...)`, send server responses with `.respond(...)`, and declare expected message counts with `.times(...)`.

```ts
test('example', () => {
  // highlight-start
  interceptor
    .message()
    .with({ type: 'message' })
    .respond((message) => ({
      type: 'presence',
      data: { online: message.data.text.length > 0 },
    }))
    .times(1);
  // highlight-end

  // Run the application and send WebSocket messages...
});
```

:::info INFO: <span>Local WebSocket interceptors are synchronous</span>

Many operations in local WebSocket interceptors are **synchronous** because they do not involve communication with an
external server. This is different from [remote interceptors](/docs/interceptor/guides/ws/remote-interceptors), which
communicate with an [interceptor server](/docs/interceptor/cli/server) to handle messages and return responses.

:::

If you need to access the messages processed by the interceptor, enable message saving and use `handler.messages`.
Message saving is enabled by default in Node.js when `process.env.NODE_ENV === 'test'` and disabled by default in
browsers. Configure `messageSaving: { enabled: true }` when you need saved messages in every environment. Saved message
arrays are readonly and keep stable references. Calling `handler.clear()` removes that handler's saved messages from the
handler, sender client, and server arrays in place; calling `interceptor.clear()` clears all saved message arrays and
resets safe-limit accounting.

```ts
const handler = interceptor
  .message()
  .with({ type: 'message' })
  .respond({ type: 'presence', data: { online: true } })
  .times(1);

// Run the application and send WebSocket messages...

console.log(handler.messages.length); // 1
console.log(handler.messages[0].data); // { type: 'message', data: { text: 'Hello!' } }
console.log(handler.messages[0].sender.url); // 'ws://localhost:3000/chat'
```

### Passive handlers

Handlers without `.respond(...)` or `.effect(...)` are valid passive handlers. They accept connections, observe matching
messages, save them when message saving is enabled, and count toward `.times()` without sending a response or running an
effect.

```ts
const handler = interceptor.message().with({ type: 'typing' }).times(1);

// Run the application and send WebSocket messages...

console.log(handler.messages.length); // 1
```

### Connected clients

The interceptor tracks currently connected clients in `interceptor.clients`. Each client is a public handle that can
send messages back to the real WebSocket connection. You can use these handles in `.from(...)` restrictions or inside
effects.

```ts
interceptor.message().effect((message) => {
  const [firstClient] = interceptor.clients;

  firstClient.send(
    JSON.stringify({
      type: 'presence',
      data: { online: message.type === 'message' },
    }),
  );
});
```

### Server sends

The interceptor also exposes a synthetic server handle. Calling `interceptor.server.send(...)` broadcasts to currently
connected clients.

```ts
interceptor.server.send(JSON.stringify({ type: 'presence', data: { online: true } }));
```

Server-originated sends are delivered to connected clients, but they are not added to handler or client saved message
lists. Saved messages are produced by matched client-to-server messages.

### Incoming message parsing

Message handlers automatically parse text frames containing valid JSON before matching restrictions, running callbacks,
or saving messages. Non-JSON text and binary frames retain their original data.

For string-based schemas, JSON-looking text such as `'{"type":"message"}'` is therefore exposed as parsed JSON rather
than as a string. Avoid JSON-looking text when the message must remain a string.
