---
title: Unhandled messages | @zimic/interceptor
sidebar_label: Unhandled messages
slug: /interceptor/guides/ws/unhandled-messages
---

# Unhandled messages

:::warning EXPERIMENTAL

WebSocket interceptors are available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming stable.

:::

When a client message reaches a WebSocket interceptor and no [message handler](/docs/zimic-interceptor/api/ws/3-websocket-message-handler.mdx) matches it, the message is considered **unhandled** and is logged to the console by default.

Unlike [unhandled HTTP requests](/docs/zimic-interceptor/guides/http/9-unhandled-requests.md), unhandled messages cannot be bypassed or rejected. WebSocket is not a request-response protocol, so a client message does not need a reply. The message is dropped and the connection stays open, in both [local](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md) and [remote](/docs/zimic-interceptor/guides/ws/2-remote-websocket-interceptors.md) interceptors.

The strategies on this page apply only to messages. Connections have no unhandled state. A connection that matches no [connection handler](/docs/zimic-interceptor/api/ws/4-websocket-connection-handler.mdx) is accepted. Learn more about [handling connections](/docs/zimic-interceptor/guides/ws/4-connections-and-sends.mdx#handling-connections).

You can override the logging behavior per interceptor with `onUnhandledMessage` in [`createWebSocketInterceptor()`](/docs/zimic-interceptor/api/ws/1-create-websocket-interceptor.mdx), or by setting [`interceptor.onUnhandledMessage`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptoronunhandledmessage). `onUnhandledMessage` also accepts a function to dynamically determine which strategy to use for each unhandled message.

:::info INFO: <span>How `@zimic/interceptor` treats unhandled messages</span>

A client message is tried against the handlers of every running interceptor [sharing its connection](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorbaseurl), from the last handler created to the first. The first handler that matches the message handles it. If a restriction, delay, effect, or response of a handler throws an error, the error is logged, the message is unhandled, and older handlers are not tried. If none handles it, the strategy of the last started interceptor still sharing the connection is used, or the default strategy if none was defined.

If the strategy is a function and it throws, the error is logged and the default strategy is used.

If no running interceptor matches the connection URL, the connection is not intercepted, so no strategy is used and no message is logged. In local interceptors, the connection reaches the real network. If the connection was targeted to an interceptor server, the server closes it with a protocol error.

:::

:::tip FAQ: <span>Why was my message unhandled?</span>

If you expected a message to be handled, but it was not, make sure that:

1. The interceptor is running before the connection is opened (see [`interceptor.start()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorstart));
2. The [base URL](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorbaseurl) of the interceptor matches the connection URL;
3. The [restrictions](/docs/zimic-interceptor/api/ws/3-websocket-message-handler.mdx#handlerwith) of the handler, if present, correctly match the message;
4. The [sender](/docs/zimic-interceptor/api/ws/3-websocket-message-handler.mdx#handlerfrom) of the handler, if present, is the client that sent the message;
5. The handler has not already matched the maximum number of messages declared with [`handler.times()`](/docs/zimic-interceptor/api/ws/3-websocket-message-handler.mdx#handlertimes).

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

You can also provide a function to `onUnhandledMessage` that receives the unhandled message and returns the strategy to use. This allows you to dynamically determine whether to log the message based on its contents. The message is typed with the messages of the interceptor schema and is parsed as in [message handlers](/docs/zimic-interceptor/api/ws/3-websocket-message-handler.mdx).

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/chat': {
    message: { type: 'ping' } | { type: 'message'; data: { text: string } };
  };
}>;

const interceptor = createWebSocketInterceptor<Schema>({
  baseURL: 'ws://localhost:3000',

  // highlight-start
  async onUnhandledMessage(message) {
    // Ignore only unhandled heartbeats and log all other unhandled messages
    return { log: message.type !== 'ping' };
  },
  // highlight-end
});
```
