---
title: WebSocket protocols | @zimic/interceptor
sidebar_label: WebSocket protocols
slug: /interceptor/api/websocket-protocols
---

# WebSocket protocols

:::warning EXPERIMENTAL

WebSocket interceptors are available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming stable.

:::

## `protocol` option

The `protocol` option of `createWebSocketInterceptor` translates the raw frames of a framed protocol into the messages seen by handlers. `with`, `respond`, `server.send`, `client.send`, `messages[].data`, `times`, and `onUnhandledMessage` then work with decoded messages. The protocol runs inside the interceptor in local and remote modes, and the interceptor server relays raw frames.

```ts
import { createWebSocketInterceptor, type WebSocketInterceptorProtocol } from '@zimic/interceptor/experimental/ws';

const protocol: WebSocketInterceptorProtocol<{ text: string }> = {
  onConnection(client) {
    client.sendFrame('welcome');
  },

  decode(frame) {
    return frame === 'keepalive' ? [] : [{ text: String(frame) }];
  },

  encode(message) {
    return [message.text];
  },
};

const interceptor = createWebSocketInterceptor<Schema>({
  baseURL: 'ws://localhost:3000',
  protocol,
});
```

| Member | Description |
| --- | --- |
| `onConnection(client)` | Optional. Called when a client connects, before connection effects run. May return a function called when the client disconnects. |
| `decode(frame, client)` | Decodes a received `string` or `ArrayBuffer` frame into messages. A frame decoded to `[]` is a control frame consumed by the protocol, and is never reported as unhandled. Decoding errors are logged. |
| `encode(message, client)` | Encodes a message sent by a handler, `client.send`, or `server.send` into frames. |

The `client` is the object listed in `interceptor.clients`, with two more members. `sendFrame(frame)` sends a raw frame without encoding it. `connectionId` is shared by the clients of interceptors holding the same connection.

## `createSocketIOProtocol`

Available from `@zimic/interceptor/experimental/socket.io`. Creates a protocol to mock Socket.IO servers, as described in the [Socket.IO guide](/docs/zimic-interceptor/guides/ws/4-socket-io.md).

| Option | Default | Description |
| --- | --- | --- |
| `namespace` | `'/'` | The namespace handled by the interceptor. |
| `polling` | `true` | Whether to intercept HTTP long-polling requests to `<base URL>/socket.io/`. |
| `parser` |  | The parser used by the client, with the same shape as the `parser` option of `socket.io-client`. |
| `pingInterval` | `25000` | The interval between pings sent to clients, in milliseconds. |
| `pingTimeout` | `20000` | The time clients wait for a ping beyond `pingInterval`, in milliseconds. |

Connections using Engine.IO protocol 3 fail with an error naming the unsupported version.

## `GlobalWebSocketTransport`

Available from `@zimic/interceptor/experimental/socket.io`. A `socket.io-client` transport that calls `new globalThis.WebSocket(...)` for each connection, which local interceptors need.

## `SocketIOSchema`

Available from `@zimic/interceptor/experimental/socket.io`. `SocketIOSchema<ServerToClientEvents, ClientToServerEvents>` creates a WebSocket schema from events declared as in `socket.io-client`. A trailing callback parameter of a client event declares its acknowledgement type.
