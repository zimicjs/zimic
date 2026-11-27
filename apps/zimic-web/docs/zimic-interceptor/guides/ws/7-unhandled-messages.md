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

The strategies on this page apply only to messages. Connections that no interceptor holds are [unhandled connections](#unhandled-connections), which no strategy applies to.

You can override the logging behavior per interceptor with `onUnhandledMessage` in [`createWebSocketInterceptor()`](/docs/zimic-interceptor/api/ws/1-create-websocket-interceptor.mdx), or by setting [`interceptor.onUnhandledMessage`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptoronunhandledmessage). `onUnhandledMessage` also accepts a function to dynamically determine which strategy to use for each unhandled message.

:::info INFO: <span>How `@zimic/interceptor` treats unhandled messages</span>

A client message is tried against the handlers of every running interceptor [sharing its connection](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorbaseurl), from the last handler created to the first. The first handler that matches the message handles it. If a restriction, delay, effect, or response of a handler throws an error, the error is logged, the message is unhandled, and older handlers are not tried. If none handles it, the strategy of the last started interceptor still sharing the connection is used, or the default strategy if none was defined.

If the strategy is a function and it throws, the error is logged and the default strategy is used.

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

## Unhandled connections

A connection is **unhandled** when no running interceptor holds it, such as when no interceptor [base URL](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorbaseurl) matches the connection URL.

A connection that reaches an interceptor is handled, even if no [connection handler](/docs/zimic-interceptor/api/ws/4-websocket-connection-handler.mdx) matches it. Interceptors accept connections by default, so logging these connections would report every connection to an interceptor without connection handlers. A connection rejected by a connection handler is also handled. Learn more about [handling connections](/docs/zimic-interceptor/guides/ws/4-connections-and-sends.mdx#handling-connections).

In [local interceptors](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md), unhandled connections are not intercepted and reach the real network. No message is logged.

The [interceptor server](/docs/zimic-interceptor/cli/1-server.md) of [remote interceptors](/docs/zimic-interceptor/guides/ws/2-remote-websocket-interceptors.md) closes unhandled connections with code `1002` and reason `'Connection was not handled and was rejected.'`. It also logs an error to the console, which some clients need because they do not expose close reasons, such as `socket.io-client`.

```
[@zimic/interceptor] Error: Connection was not handled and was rejected.

  ws://localhost:4000/socket.io/?EIO=4&transport=websocket
    Search params: { EIO: '4', transport: 'websocket' }
    Protocols: []

Learn more: https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages#unhandled-connections
```

The server also logs a connection whose interceptor stops, is cleared, disconnects, or fails before accepting it. A connection whose interceptor stops or is cleared closes normally with code `1000`. A connection whose interceptor disconnects or fails closes with code `1002` and reason `'Could not connect to the WebSocket interceptor.'`. Disable these logs with the [`--log-unhandled-connections`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-start) option of the CLI, or with [`logUnhandledConnections`](/docs/zimic-interceptor/api/server/1-create-interceptor-server.md) in programmatic servers.

:::tip FAQ: <span>Why was my connection unhandled?</span>

If you expected a connection to be handled, but it was not, make sure that:

1. The interceptor is running before the connection is opened (see [`interceptor.start()`](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorstart));
2. The [base URL](/docs/zimic-interceptor/api/ws/2-websocket-interceptor.mdx#interceptorbaseurl) of the interceptor is a prefix of the connection URL shown in the log;
3. If you use Socket.IO, the path of the base URL is passed to the `path` option of `io()`, not in its URL (see [connecting clients](/docs/zimic-interceptor/guides/ws/9-socket-io.mdx#connecting-clients)).

A Socket.IO socket that fails with a `connect_error` of message `'Invalid namespace'` reached an interceptor, but no interceptor of its base URL handles its [namespace](/docs/zimic-interceptor/guides/ws/9-socket-io.mdx#namespaces). The interceptor logs an error with the namespace.

```
[@zimic/interceptor] Error: Socket.IO namespace connection was not handled and was rejected.

  ws://localhost:4000/socket.io/?EIO=4&transport=websocket
    Namespace: /typo

Learn more: https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages#unhandled-connections
```

:::
