---
title: Using remote WebSocket interceptors | @zimic/interceptor
sidebar_label: Using remote interceptors
slug: /interceptor/guides/ws/remote-interceptors
---

# Using remote WebSocket interceptors

:::warning EXPERIMENTAL

WebSocket interceptors are available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming
stable.

:::

WebSocket interceptors allow you to handle client messages and send custom server messages. Their primary use is to mock
WebSocket flows in development or testing environments, especially when the backend is unavailable or when you want to
control connection and message scenarios.

In `@zimic/interceptor`, WebSocket interceptors are available in two types: `local` (default) and `remote`. Interceptors
with type `remote` use a dedicated [interceptor server](/docs/interceptor/cli/server) to handle WebSocket connections
and messages. This opens up more possibilities for mocking than
[local interceptors](/docs/interceptor/guides/ws/local-interceptors), such as handling connections from multiple
applications. Remote WebSocket interceptors require `type: 'remote'`.

Application clients must provide a native or polyfilled
[WebSocket API](https://developer.mozilla.org/docs/Web/API/WebSocket). Browsers normally provide it natively; Node.js
clients must expose the native `WebSocket` or a compatible polyfill. Node.js projects consuming the WebSocket
interceptor packages require Node.js 22.4 or later. This includes the process declaring the remote interceptor and the
separately running interceptor server, which accepts application WebSocket connections and relays messages between the
clients and interceptor.

## When to use remote WebSocket interceptors

- **Development**

  Remote interceptors are useful if you want mocked WebSocket flows to be accessible by multiple applications (e.g.
  browser, other projects, test clients). This is not possible with local interceptors, which only work in the
  application where they are defined.

- **Testing**

  If you do not run your application in the same process as your tests, remote interceptors are the way to go to mock
  WebSocket messages and verify how your application handles server responses, broadcasts, and connection state. When
  using [Cypress](https://www.cypress.io), [Playwright](https://playwright.dev), or other end-to-end testing tools, this
  is generally the case because the test runner and the application run separately.

## Creating a remote WebSocket interceptor

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
points to the URL that your application will use to open WebSocket connections.

In the case of a remote interceptor, the `baseURL` should point to an
[interceptor server](/docs/interceptor/cli/server), which is configured by the interceptor to handle connections and
messages.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

const interceptor = createWebSocketInterceptor<Schema>({
  // highlight-next-line
  type: 'remote',
  baseURL: 'ws://localhost:3000/chat',
  messageSaving: { enabled: true },
});
```

You can also set other options, such as authentication and message saving.

:::info INFO: <span>WebSocket interceptor scope</span>

WebSocket interceptors are designed for typed test and development mocks. They do not proxy unmatched WebSocket traffic
to an upstream server, and they do not provide a general-purpose WebSocket gateway. Declare handlers for the messages
your test expects to observe or mock.

:::

### Path discriminators

When using multiple remote interceptors connected to the same interceptor server, it is important to differentiate them
by using path discriminators. This is done by appending a suffix to the `baseURL` of each interceptor and makes sure
that no interceptor interferes with another's connections and messages.

This is especially useful if you have multiple interceptors mocking different services or WebSocket endpoints, or if you
are running tests in parallel, each with its own interceptors.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

const chatInterceptor = createWebSocketInterceptor<ChatSchema>({
  type: 'remote',
  // highlight-next-line
  baseURL: `ws://localhost:3000/chat/${crypto.randomUUID()}`,
});

const notificationInterceptor = createWebSocketInterceptor<NotificationSchema>({
  type: 'remote',
  // highlight-next-line
  baseURL: `ws://localhost:3000/notifications/${crypto.randomUUID()}`,
});
```

If you are using a setup like this, note that your application should use the same base URL as the interceptor when
opening WebSocket connections, otherwise they may not be handled. A common strategy is to change an environment variable
or similar to point to the base URL of the interceptor.

```ts
process.env.CHAT_SOCKET_URL = chatInterceptor.baseURL;
process.env.NOTIFICATION_SOCKET_URL = notificationInterceptor.baseURL;
```

## WebSocket interceptor lifecycle

### Starting an interceptor

To intercept connections and messages, start the interceptor server using the
[`zimic-interceptor server start`](/docs/interceptor/cli/server#zimic-interceptor-server-start) CLI. It can run as a
standalone server:

```bash
zimic-interceptor server start --port 3000
```

Or as a prefix of another command, such as a test runner or a script:

```bash
zimic-interceptor server start --port 3000 --ephemeral -- npm run test
```

The command after `--` will be executed when the server is ready. The flag `--ephemeral` indicates that the server
should automatically stop after the command `npm run test` finishes.

:::info IMPORTANT: <span>Interceptor server authentication</span>

If you are exposing the server publicly, consider [enabling authentication](#interceptor-server-authentication) in the
interceptor server.

:::

Once the server is running, you can start the interceptor with `interceptor.start()`. This is usually done in a
`beforeAll` hook in your test suite.

```ts
beforeAll(async () => {
  // highlight-next-line
  await interceptor.start();
});
```

During the start up, the interceptor will connect to the server and get ready to handle WebSocket connections and
messages.

### Clearing an interceptor

When using an interceptor in tests, it's important to clear it between tests to avoid one test affecting another. This
is performed with `interceptor.clear()`, which resets handlers, saved messages, connected clients, and server messages
to their initial states.

```ts
beforeEach(async () => {
  // highlight-next-line
  await interceptor.clear();
});
```

### Checking expectations

After each test, you can check if your application has sent all of the expected messages with
`interceptor.checkTimes()`.

```ts
afterEach(async () => {
  // highlight-next-line
  await interceptor.checkTimes();
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
test('example', async () => {
  // highlight-start
  await interceptor
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

:::info INFO: <span>Remote WebSocket interceptors are asynchronous</span>

Many operations in remote WebSocket interceptors are **asynchronous** because they may involve communication with an
interceptor server. This is different from [local interceptors](/docs/interceptor/guides/ws/local-interceptors), which
have mostly **synchronous** operations. Await remote handler chains that register or update handlers, such as
`.respond(...)`, `.times(...)`, `.clear()`, and `.checkTimes()`.

WebSocket frames arrive in transport order, but Zimic handles messages independently. Asynchronous restrictions,
effects, delays, and responses can overlap and complete in any order. Do not rely on handler-completion or response
order.

If you are using [`typescript-eslint`](https://typescript-eslint.io), a handy rule is
[`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises). It checks promises
appearing to be unhandled, which is helpful to indicate missing `await`'s in remote interceptor operations.

:::

If you need to access the messages processed by the interceptor, enable message saving and use `handler.messages`.
Message saving is enabled by default in Node.js when `process.env.NODE_ENV === 'test'` and disabled by default in
browsers. Configure `messageSaving: { enabled: true }` when you need saved messages in every environment. Saved message
arrays are readonly and keep stable references. Calling `handler.clear()` removes that handler's saved messages from the
handler, sender client, and server arrays in place; calling `interceptor.clear()` clears all saved message arrays and
resets safe-limit accounting.

`handler.clear()` returns the same handler reset to the root message schema. Continue configuration from that returned
handler when a previous `.with(...)` narrowed its message type. An older narrowed alias does not retain sound narrowing
after either the handler or interceptor is cleared.

```ts
const narrowedHandler = await interceptor.message().with({ type: 'typing' });
const rootHandler = await narrowedHandler.clear();

await rootHandler.respond({ type: 'presence', data: { online: true } });
```

```ts
const handler = await interceptor
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
const handler = await interceptor.message().with({ type: 'typing' }).times(1);

// Run the application and send WebSocket messages...

console.log(handler.messages.length); // 1
```

### Connected clients

The interceptor tracks currently connected clients in `interceptor.clients`. Each client is a public handle that can
send messages back to the real WebSocket connection. You can use these handles in `.from(...)` restrictions or inside
effects.

```ts
await interceptor.message().effect((message) => {
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

### Remote message transport

Remote WebSocket interceptors preserve the frame kind of each message. Text frames remain text, JSON messages remain
JSON, and binary frames remain binary when they pass through the interceptor server. Zimic uses an internal transport
envelope for remote messages, so user payloads such as `{ type: 'binary', data: '...' }` are still treated as JSON when
they were sent as JSON, not as transport metadata.

Before matching restrictions or running callbacks, handlers parse text frames containing valid JSON. Non-JSON text and
binary frames retain their original data. For string-based schemas, JSON-looking text such as `'{"type":"message"}'` is
therefore exposed as parsed JSON rather than as a string. Avoid JSON-looking text when the message must remain a string.

Binary messages can be sent with `Blob`, `ArrayBuffer`, typed arrays, and `DataView` values.

### Remote connection setup failures

When a user WebSocket connects through the interceptor server, the server confirms the connection with the remote
interceptor before retaining it as a connected client. While confirmation is pending, the server pauses the socket and
resumes it after normal message listeners are attached. Standards-valid frames sent immediately after the user observes
`open` are preserved and processed in order. If setup cannot complete, the server closes the user socket and removes any
temporary connection state.

## Interceptor server authentication

Interceptor servers can be configured to require interceptor authentication. This is **strongly recommended** if you are
exposing the server **publicly**. Without authentication, the server is unprotected and any interceptor can connect to
it and override the responses or messages handled by the server.

To create an interceptor authentication token, use the
[`zimic-interceptor server token create`](/docs/interceptor/cli/server#zimic-interceptor-server-token-create) CLI:

```bash
zimic-interceptor server token create \
  --name <token-name>
```

Then, start the server using the `--tokens-dir` option pointing to the directory where the tokens are saved. The server
will only accept remote interceptors bearing a valid token.

```bash
zimic-interceptor server start --port 3000 \
  --tokens-dir .zimic/interceptor/server/tokens
```

:::important IMPORTANT: <span>Private tokens directory</span>

Make sure to keep the tokens directory private. Do not commit it to version control or expose it publicly. Even though
the tokens are hashed in the directory, exposing it can lead to security issues. If you are running the server inside a
container, make sure to persist the tokens directory, such as in a volume. Otherwise, the tokens will be lost when the
container is removed or recreated.

:::

Once the server is running, remote interceptors can use the `auth.token` option to provide a token.

```ts
import { createWebSocketInterceptor, type WebSocketInterceptorAuthOptions } from '@zimic/interceptor/experimental/ws';

const auth: WebSocketInterceptorAuthOptions = {
  token: '<token>',
};

const interceptor = createWebSocketInterceptor<Schema>({
  type: 'remote',
  baseURL: 'ws://localhost:3000/chat',
  auth,
});
```
