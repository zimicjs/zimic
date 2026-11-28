---
title: Using local WebSocket interceptors | @zimic/interceptor
sidebar_label: Using local interceptors
slug: /interceptor/guides/ws/local-interceptors
---

# Using local WebSocket interceptors

:::warning EXPERIMENTAL

WebSocket interceptors are available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming stable.

:::

WebSocket interceptors allow you to handle client messages and send custom server messages. Their primary use is to mock WebSocket flows in development or testing environments, especially when the backend is unavailable or when you want to control connection and message scenarios.

In `@zimic/interceptor`, WebSocket interceptors are available in two types: `local` (default) and `remote`. When an interceptor is `local`, Zimic uses [MSW](https://github.com/mswjs/msw) to intercept WebSocket connections _in the same process_ as your application. This is the simplest way to start mocking WebSocket messages and does not require any server setup.

Local interceptors intercept only connections opened with `globalThis.WebSocket`.

:::info INFO: <span>WebSocket libraries in Node.js</span>

Libraries that open their own sockets in Node.js, such as [`ws`](https://github.com/websockets/ws) and [`isomorphic-ws`](https://github.com/heineiuo/isomorphic-ws), connect directly to the network and are not intercepted by local interceptors. Use [remote interceptors](/docs/zimic-interceptor/guides/ws/2-remote-websocket-interceptors.md) to mock connections opened by these libraries.

:::

## When to use local WebSocket interceptors

- **Development**

  Local interceptors are useful if you want to quickly mock WebSocket messages for a single application in development, especially when the backend is not yet ready or when you want to test different connection and message scenarios without relying on a real server.

- **Testing**

  If you run your application in the same process as your tests, local interceptors are a good way to mock WebSocket messages and verify how your application handles server messages, broadcasts, and connection state. This is common when using unit and integration test runners such as [Jest](https://jestjs.io) and [Vitest](https://vitest.dev).

## Creating a local WebSocket interceptor

To start using a WebSocket interceptor, declare a WebSocket schema using [`@zimic/ws`](/docs/zimic-ws/guides/1-schemas.md). The schema represents the structure of your WebSocket service, including the paths and the messages exchanged by clients and servers.

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type ChatMessage =
  | { type: 'message'; data: { text: string } }
  | { type: 'typing'; data: { username: string } }
  | { type: 'presence'; data: { online: boolean } };

type Schema = WebSocketSchema<{
  '/chat': {
    message: ChatMessage;
  };
}>;
```

With the schema defined, you can now create your interceptor with [`createWebSocketInterceptor`](/docs/zimic-interceptor/api/ws/1-create-websocket-interceptor.mdx). It takes the schema as a type parameter and returns an interceptor instance. The `baseURL` option represents the scope of the interceptor and points to the URL that your application will use to open WebSocket connections.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

const interceptor = createWebSocketInterceptor<Schema>({
  // highlight-next-line
  type: 'local', // optional
  baseURL: 'ws://localhost:3000',
});
```

You can also set other options, such as the interceptor type and how unhandled messages should be treated. Refer to the [`createWebSocketInterceptor` API reference](/docs/zimic-interceptor/api/ws/1-create-websocket-interceptor.mdx) for more details.

## WebSocket interceptor lifecycle

### Starting an interceptor

To intercept connections and messages, an interceptor must be started with [`interceptor.start()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorstart). This is usually done in a `beforeAll` hook in your test suite.

```ts
beforeAll(async () => {
  // highlight-next-line
  await interceptor.start();
});
```

### Clearing an interceptor

When using an interceptor in tests, it's important to clear it between tests to avoid that one test affects another. This is done with [`interceptor.clear()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorclear), which resets the interceptor and handlers to their initial states.

```ts
beforeEach(() => {
  // highlight-next-line
  interceptor.clear();
});
```

### Checking expectations

After each test, you can check if your application has sent all of the expected messages and opened all of the expected connections with [`interceptor.checkTimes()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorchecktimes). Learn more about how interceptors support [declarative assertions](/docs/zimic-interceptor/guides/ws/5-declarative-assertions.mdx) to keep your tests clean and readable.

```ts
afterEach(() => {
  // highlight-next-line
  interceptor.checkTimes();
});
```

### Stopping an interceptor

After the interceptor is no longer needed, such as at the end of your test suite, you can stop it with [`interceptor.stop()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorstop).

```ts
afterAll(async () => {
  // highlight-next-line
  await interceptor.stop();
});
```

### Mocking messages

You can now use the interceptor to handle client messages and send mock server messages. All paths, messages, restrictions, and responses are typed by default based on the schema.

Use [`interceptor.message()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptormessage) to create a [message handler](/docs/zimic-interceptor/api/ws/3-websocket-message-handler.mdx). To handle connections, use [`interceptor.connection()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorconnection), as described in [Using connections and server sends](/docs/zimic-interceptor/guides/ws/4-connections-and-sends.mdx).

```ts
test('example', () => {
  // highlight-start
  interceptor
    .message('/chat')
    .with({ type: 'message' })
    .respond((message) => ({
      type: 'presence',
      data: { online: message.data.text.length > 0 },
    }))
    .times(1);
  // highlight-end

  // Run the application and send messages...
});
```

Messages arrive in the order the client sent them. Zimic handles each message independently, so asynchronous restrictions, delays, effects, and responses can overlap and complete in any order.

Handler declarations, [`interceptor.clear()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorclear), and [`interceptor.checkTimes()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorchecktimes) are synchronous in local interceptors because they do not communicate with an external server. In [remote interceptors](/docs/zimic-interceptor/guides/ws/2-remote-websocket-interceptors.md#mocking-messages), they are asynchronous instead.

For checks that a restriction cannot express, see [inspecting messages and connections](/docs/zimic-interceptor/guides/ws/5-declarative-assertions.mdx#inspecting-messages-and-connections).
