---
title: Using remote WebSocket interceptors | @zimic/interceptor
sidebar_label: Using remote interceptors
slug: /interceptor/guides/ws/remote-interceptors
---

# Using remote WebSocket interceptors

:::warning EXPERIMENTAL

WebSocket interceptors are available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming stable.

:::

WebSocket interceptors allow you to handle client messages and send custom server messages. Their primary use is to mock WebSocket flows in development or testing environments, especially when the backend is unavailable or when you want to control connection and message scenarios.

In `@zimic/interceptor`, WebSocket interceptors are available in two types: `local` (default) and `remote`. Interceptors with type `remote` use a dedicated [interceptor server](/docs/zimic-interceptor/cli/1-server.md) to handle WebSocket connections and messages. This opens up more possibilities for mocking than [local interceptors](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md), such as handling connections from multiple applications.

Remote interceptors work with any WebSocket client, including libraries such as [`ws`](https://github.com/websockets/ws), because clients connect to a real WebSocket server.

## When to use remote WebSocket interceptors

- **Development**

  Remote interceptors are useful if you want your mocked WebSocket flows to be accessible by multiple applications (e.g. browser, other projects, test clients). This is not possible with local interceptors, which only work in the application where they are defined.

- **Testing**

  If you do not run your application in the same process as your tests, remote interceptors are the way to go to mock WebSocket messages and verify how your application handles server messages, broadcasts, and connection state. When using [Cypress](https://www.cypress.io), [Playwright](https://playwright.dev), or other end-to-end testing tools, this is generally the case because the test runner and the application run separately.

## Creating a remote WebSocket interceptor

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

In the case of a remote interceptor, the `baseURL` should point to an [interceptor server](/docs/zimic-interceptor/cli/1-server.md), which is configured by the interceptor to handle connections and messages.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

const interceptor = createWebSocketInterceptor<Schema>({
  // highlight-next-line
  type: 'remote',
  baseURL: 'ws://localhost:3000',
});
```

You can also set other options, such as the interceptor type and how unhandled messages should be treated. Refer to the [`createWebSocketInterceptor` API reference](/docs/zimic-interceptor/api/ws/1-create-websocket-interceptor.mdx) for more details.

### Path discriminators

When using multiple remote interceptors connected to the same interceptor server, it is important to differentiate them by using path discriminators. This is done by appending a suffix to the `baseURL` of each interceptor and makes sure that no interceptor interferes with another's connections and messages.

This is especially useful if you have multiple interceptors mocking different services or WebSocket endpoints, or if you are running tests in parallel, each with its own interceptors.

Consider the following example:

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
  baseURL: `ws://localhost:3000/notification/${crypto.randomUUID()}`,
});
```

Here, two remote interceptors are created, one for a fictional chat service and another for a notification service. Both interceptors use the same interceptor server, but they are differentiated by service with the paths `/chat` and `/notification`. Moreover, [`crypto.randomUUID()`](https://developer.mozilla.org/docs/Web/API/Crypto/randomUUID) is used to generate a unique identifier for each interceptor, which makes sure that they don't interfere with each other if multiple instances are running at the same time.

If you are using a setup like this, note that your application should use the same base URL as the interceptor when opening WebSocket connections, otherwise they may not be handled. A common strategy is to change an environment variable or similar to point to the base URL of the interceptor.

```ts
process.env.CHAT_SERVICE_URL = chatInterceptor.baseURL;
process.env.NOTIFICATION_SERVICE_URL = notificationInterceptor.baseURL;
```

## WebSocket interceptor lifecycle

### Starting an interceptor

To intercept connections and messages, start the interceptor server using the [`zimic-interceptor server start`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-start) CLI. It can run as a standalone server:

```bash
zimic-interceptor server start --port 3000
```

Or as a prefix of another command, such as a test runner or a script:

```bash
zimic-interceptor server start --port 3000 --ephemeral -- npm run test
```

The command after `--` will be executed when the server is ready. The flag `--ephemeral` indicates that the server should automatically stop after the command `npm run test` finishes.

:::info NOTE: <span>Interceptor servers in development and testing</span>

Interceptor servers are development and test tools. Do not use them as production application servers.

:::

:::info NOTE: <span>Interceptor server versions</span>

Use the same `@zimic/interceptor` version for the interceptor server and your remote interceptors. Changes to how they communicate ship in minor releases and are not breaking changes, so a server on another version may reject your interceptors when they start.

:::

:::info IMPORTANT: <span>Interceptor server authentication</span>

Although authentication is optional for private development servers, we strongly recommend [enabling it](#interceptor-server-authentication) when the server is not bound to `localhost`, `127.0.0.1`, or `::1`, or when it is shared over a network. Authentication prevents unauthorized remote interceptors from connecting to the server.

:::

Once the server is running, you can start the interceptor with [`interceptor.start()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorstart). This is usually done in a `beforeAll` hook in your test suite.

```ts
beforeAll(async () => {
  // highlight-next-line
  await interceptor.start();
});
```

During the start up, the interceptor will connect to the server and get ready to handle WebSocket connections and messages.

### Clearing an interceptor

When using an interceptor in tests, it's important to clear it between tests to avoid that one test affects another. This is performed with [`interceptor.clear()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorclear), which resets the interceptor and handlers to their initial states.

```ts
beforeEach(async () => {
  // highlight-next-line
  await interceptor.clear();
});
```

### Checking expectations

After each test, you can check if your application has sent all of the expected messages and opened all of the expected connections with [`interceptor.checkTimes()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorchecktimes). Learn more about how interceptors support [declarative assertions](/docs/zimic-interceptor/guides/ws/5-declarative-assertions.mdx) to keep your tests clean and readable.

```ts
afterEach(async () => {
  // highlight-next-line
  await interceptor.checkTimes();
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
test('example', async () => {
  // highlight-start
  await interceptor
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

Remote interceptors handle messages in the same [order as local interceptors](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md#mocking-messages).

:::info INFO: <span>Remote interceptors are asynchronous</span>

Many operations in remote interceptors are **asynchronous** because they may involve communication with an interceptor server. This is different from [local interceptors](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md), which have mostly **synchronous** operations.

If you are using [`typescript-eslint`](https://typescript-eslint.io), a handy rule is [`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises). It checks promises appearing to be unhandled, which is helpful to indicate missing `await`'s in remote interceptor operations.

:::

If you need to access the messages processed by the interceptor, use [`handler.messages`](/docs/zimic-interceptor/api/ws/3-websocket-message-handler.mdx#handlermessages).

```ts
// highlight-next-line
const handler = await interceptor
  .message('/chat')
  .with({ type: 'message' })
  .respond({ type: 'presence', data: { online: true } })
  .times(1);

// Run the application and send messages...

console.log(handler.messages.length); // 1

console.log(handler.messages[0].data); // { type: 'message', data: { text: 'Hello!' } }
console.log(handler.messages[0].sender.url); // 'ws://localhost:3000/chat'
```

## Interceptor server authentication

While authentication is optional for private development servers, we strongly recommend enabling authentication when the server is bound to a hostname other than `localhost`, `127.0.0.1`, or `::1`, or is shared over a network. Authentication prevents unauthorized remote interceptors from connecting to the server.

Without authentication, browser remote interceptors can connect only when both the interceptor server and the web application use a loopback hostname: `localhost`, `127.0.0.1`, or `::1`. Configure authentication if either one uses another hostname. This restriction does not apply to remote interceptors running outside a browser.

Starting an unauthenticated server through the CLI or [`createInterceptorServer`](/docs/zimic-interceptor/api/server/1-create-interceptor-server.md) logs a warning when the server uses a non-loopback hostname or runs with `NODE_ENV=production`. The warning does not stop the server in v1.

In `@zimic/interceptor` v2, unauthenticated servers will refuse to start on non-loopback hostnames.

To create an interceptor authentication token, use the [`zimic-interceptor server token create`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-token-create) CLI:

```bash
zimic-interceptor server token create \
  --name <token-name>
```

Then, start the server using the `--tokens-dir` option pointing to the directory where the tokens are saved. The server will only accept remote interceptors bearing a valid token, regardless of where they run.

```bash
zimic-interceptor server start --port 3000 \
  --tokens-dir .zimic/interceptor/server/tokens
```

You can list the authorized tokens with [`zimic-interceptor server token ls`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-token-ls).

:::important IMPORTANT: <span>Private tokens directory</span>

Make sure to keep the tokens directory private. Do not commit it to version control or expose it publicly. Even though the tokens are hashed in the directory, exposing it can lead to security issues. If you are running the server inside a container, make sure to persist the tokens directory, such as in a volume. Otherwise, the tokens will be lost when the container is removed or recreated.

:::

Once the server is running, remote interceptors can use the `auth.token` option to provide a token.

```ts
import { createWebSocketInterceptor, type WebSocketInterceptorAuthOptions } from '@zimic/interceptor/experimental/ws';

const auth: WebSocketInterceptorAuthOptions = { token: '<token>' };

const interceptor = createWebSocketInterceptor<Schema>({
  type: 'remote',
  baseURL: 'ws://localhost:3000',
  // highlight-next-line
  auth,
});
```

Replace `<token>` with the token you created earlier. Interceptor tokens do not expire, so you can use the same token for multiple interceptors. If you need to invalidate a token, use the [`zimic-interceptor server token rm`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-token-rm) CLI.
