---
title: Unhandled messages | @zimic/interceptor
sidebar_label: Unhandled messages
slug: /interceptor/guides/ws/unhandled-messages
---

# Unhandled messages

When a client message reaches a WebSocket interceptor and no [message handler](/docs/interceptor/api/websocket-message-handler) matches it, the message is considered **unhandled** and is logged to the console by default.

Unlike [unhandled HTTP requests](/docs/interceptor/guides/http/unhandled-requests), unhandled messages cannot be bypassed or rejected. WebSocket is not a request-response protocol, so a client message does not need a reply. The message is dropped and the connection stays open, in both [local](/docs/interceptor/guides/ws/local-interceptors) and [remote](/docs/interceptor/guides/ws/remote-interceptors) interceptors.

You can override the logging behavior per interceptor with `onUnhandledMessage` in [`createWebSocketInterceptor()`](/docs/interceptor/api/create-websocket-interceptor), or by setting [`interceptor.onUnhandledMessage`](/docs/interceptor/api/websocket-interceptor#interceptoronunhandledmessage). `onUnhandledMessage` also accepts a function to dynamically determine which strategy to use for each unhandled message.

:::info INFO: <span>How `@zimic/interceptor` treats unhandled messages</span>

Each WebSocket connection belongs to a single running interceptor whose base URL matches the connection URL. If multiple interceptors match, the **last** one started with `await interceptor.start()` owns the connection. When a client message on that connection is unhandled, the strategy of the owning interceptor is used, or the default strategy if none was defined.

If the strategy is a function and it throws, the error is logged and the default strategy is used.

If no running interceptor matches the connection URL, the connection is not intercepted, so no strategy is used and no message is logged. In local interceptors, the connection reaches the real network. If the connection was targeted to an interceptor server, the server closes it with a protocol error.

:::

:::tip FAQ: <span>Why was my message unhandled?</span>

If you expected a message to be handled, but it was not, make sure that:

1. The interceptor is running before the connection is opened (see [`interceptor.start()`](/docs/interceptor/api/websocket-interceptor#interceptorstart));
2. The [base URL](/docs/interceptor/api/websocket-interceptor#interceptorbaseurl) of the interceptor matches the connection URL;
3. The [restrictions](/docs/interceptor/api/websocket-message-handler#handlerwith) of the handler, if present, correctly match the message;
4. The [sender](/docs/interceptor/api/websocket-message-handler#handlerfrom) of the handler, if present, is the client that sent the message;
5. The handler has not already matched the maximum number of messages declared with [`handler.times()`](/docs/interceptor/api/websocket-message-handler#handlertimes).

:::

## Ignoring unhandled messages

Use `log: false` to stop logging unhandled messages. This is useful for messages that you don't need to handle in your tests, such as heartbeats.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

const interceptor = createWebSocketInterceptor<Schema>({
  baseURL: 'ws://localhost:3000',
  // highlight-next-line
  onUnhandledMessage: { log: false },
});
```

## Dynamically ignoring unhandled messages

You can also provide a function to `onUnhandledMessage` that receives the unhandled message and returns the strategy to use. This allows you to dynamically determine whether to log the message based on its contents. JSON text messages are received already parsed, while other text and binary messages are received as sent.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

const interceptor = createWebSocketInterceptor<Schema>({
  baseURL: 'ws://localhost:3000',

  // highlight-start
  async onUnhandledMessage(message) {
    const isHeartbeat = typeof message === 'object' && message !== null && 'type' in message && message.type === 'ping';

    // Ignore only unhandled heartbeats and log all other unhandled messages
    return { log: !isHeartbeat };
  },
  // highlight-end
});
```
