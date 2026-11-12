---
title: Mocking Socket.IO servers | @zimic/interceptor
sidebar_label: Socket.IO
slug: /interceptor/guides/ws/socket-io
---

# Mocking Socket.IO servers

:::warning EXPERIMENTAL

WebSocket interceptors and the Socket.IO adapter are available from `@zimic/interceptor/experimental/ws` and `@zimic/interceptor/experimental/socket.io`. Their API may change before becoming stable.

:::

The Socket.IO adapter lets you mock a Socket.IO server with WebSocket interceptor handlers, without implementing the Engine.IO and Socket.IO protocols. It supports Socket.IO v3 and v4 (Engine.IO protocol 4 and Socket.IO protocol 5).

Install the parsers the adapter uses. `@zimic/http` is also required, because the adapter intercepts HTTP polling requests:

```bash
npm install --save-dev socket.io-client socket.io-parser engine.io-parser @zimic/http
```

## Creating an interceptor

Pass `createSocketIOProtocol()` as the `protocol` of a WebSocket interceptor and declare your events with `SocketIOSchema`, as in `socket.io-client`:

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';
import { createSocketIOProtocol, type SocketIOSchema } from '@zimic/interceptor/experimental/socket.io';

interface ServerToClientEvents {
  'user:created': (user: { id: string }) => void;
}

interface ClientToServerEvents {
  'user:create': (input: { name: string }, ack: (user: { id: string }) => void) => void;
}

const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
  baseURL: 'ws://localhost:3000',
  protocol: createSocketIOProtocol(),
});
```

The interceptor answers the Engine.IO open packet, the Socket.IO connect packet, and pings without any handlers.

## Connecting local interceptors

The built-in `websocket` transport of `socket.io-client` keeps the `WebSocket` constructor it finds when its module loads, before local interceptors replace it. Pass the exported `GlobalWebSocketTransport` instead, which requires `socket.io-client` 4.8 or later. Since transport names and classes cannot be mixed, also pass the polling class to keep polling enabled, which is `NodeXHR` in Node.js and `XHR` in browsers:

```ts
import { GlobalWebSocketTransport } from '@zimic/interceptor/experimental/socket.io';
import { io, NodeXHR } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: [NodeXHR, GlobalWebSocketTransport],
});
```

Remote interceptors work with the default transports of `socket.io-client`.

## Handling events

Handlers receive events as `{ type, data, args? }`. `type` is the event name, `data` is the first argument, and `args` holds the remaining arguments, omitted when there are none.

:::info NOTE: <span>`args` is not `...args`</span>

Unlike the `...args` of a Socket.IO listener, `args` does not include the first argument.

:::

```ts
await interceptor
  .message()
  .with({ type: 'user:create', data: { name: 'Name' } })
  .respond({ type: 'user:created', data: { id: '1' } })
  .times(1);
```

`with`, `respond`, `server.send`, `client.send`, `messages[].data`, `times`, and `onUnhandledMessage` all use this shape.

## Acknowledging events

When a client passes an ack callback, the received message carries `ackId`. Respond or send `{ ackId, data, args? }` to call the callback:

```ts
await interceptor
  .message()
  .with({ type: 'user:create' })
  .respond((message) => ({ ackId: message.ackId!, data: { id: '1' } }));
```

## Namespaces

Each interceptor handles one namespace, `'/'` by default, and ignores the frames of the others. Create one interceptor per namespace with the same base URL:

```ts
const adminInterceptor = createWebSocketInterceptor<AdminSchema>({
  baseURL: 'ws://localhost:3000',
  protocol: createSocketIOProtocol({ namespace: '/admin' }),
});
```

Interceptors of the same base URL share each connection, and the first one started decides the `polling`, `pingInterval`, and `pingTimeout` options. Unlike other WebSocket interceptors sharing a connection, each one handles its namespace independently, so use a single interceptor for each namespace and a new `createSocketIOProtocol()` for each interceptor. A socket connecting to a namespace without an interceptor fails with a `connect_error` of message `Invalid namespace`. Dynamic namespaces are not supported.

## Clients

As with the `connection` event of a Socket.IO server, an interceptor lists a client in `interceptor.clients` and runs its connection handlers only when a socket joins its namespace. The `url` of the client is the Engine.IO connection URL, `<base URL>/socket.io/?EIO=4&transport=...`.

- A connection handler rejecting a socket fails it with a `connect_error` of message `Connection rejected`. Other namespaces on the same connection stay connected.
- `socket.disconnect()` in the client removes its client from the interceptor of its namespace.
- `client.close()` disconnects the socket from the namespace, as `socket.disconnect()` in a Socket.IO server. Socket.IO has no close codes, so the code and reason are ignored.
- `interceptor.clear()` and `interceptor.stop()` disconnect the sockets of the namespace and close each of their connections that no other namespace uses. Sockets whose connection handlers are still running receive no reply.

## Polling

Polling is enabled by default. While the interceptor runs, the adapter intercepts HTTP requests to `<base URL>/socket.io/` with an internal HTTP interceptor of the same `type`, which `interceptor.clear()` does not remove.

A socket keeps the same client when its polling session upgrades to WebSocket. Events sent over polling reach the same handlers, and messages sent to the client wait for its next poll.

Pass `polling: false` if your clients only use WebSocket. Polling clients then fail with `connect_error`, and the interceptor logs a warning naming the fix.

## Binary attachments

Binary arguments arrive in handlers as `ArrayBuffer`. Handlers can send `ArrayBuffer` and typed arrays. Sending `Blob` attachments is not supported.

## Custom parsers

If your client uses a custom parser, pass the same parser to the adapter:

```ts
import msgpackParser from 'socket.io-msgpack-parser';

const protocol = createSocketIOProtocol({ parser: msgpackParser });
```
