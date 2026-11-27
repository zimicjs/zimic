---
title: Declaring schemas | @zimic/ws
sidebar_label: Schemas
slug: /ws/guides/schemas
---

# Declaring schemas

A central part of `@zimic/ws` is a WebSocket schema, which is a TypeScript type describing the structure of a WebSocket service. The schema serves as a centralized source of truth about the paths, connections, and messages of the service, and can be used to type your clients and servers, as well as [`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md).

A `@zimic/ws` schema is defined with the [`WebSocketSchema`](/docs/zimic-ws/api/1-websocket-schema.md) type.

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

// Declaring the base types
type ChatMessage =
  | { type: 'message'; data: { text: string } }
  | { type: 'typing'; data: { username: string } }
  | { type: 'presence'; data: { online: boolean } };

interface Notification {
  type: 'notification';
  data: { id: string; read: boolean };
}

// Declaring the schema
// highlight-next-line
export type ChatSchema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: {
      searchParams: { token: string };
      protocols: 'chat' | 'json';
    };
    message: ChatMessage;
  };

  '/notifications': {
    message: Notification;
  };
}>;
```

This example contains two paths, `/rooms/:roomId` and `/notifications`, each with their own messages. Connections to `/rooms/:roomId` require a `token` search param and can request the `chat` or `json` subprotocols.

## Declaring paths

At the root of the schema, you declare the paths of the service as keys, relative to its base URL.

Path parameters start with a colon (`:`) followed by an identifier, such as `:roomId`. You can make a path parameter optional by suffixing it with a question mark (`?`), as in `:roomId?`.

By default, path parameters match a single segment, not including slashes (`/`). By using a plus sign (`+`) as suffix, such as `:channel+`, you can create repeating path parameters, which accept one or more segments. If the parameter is repeating and optional, matching zero or more segments, suffix it with an asterisk (`*`) instead of `+`, like `:channel*`.

All path parameters are typed as strings, even if they match multiple segments. Optional parameters can also be `undefined`.

```ts
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  // highlight-next-line
  '/notifications': {
    message: { type: 'notification' };
  };
  // highlight-next-line
  '/rooms/:roomId': {
    message: { type: 'message' };
  };
  // highlight-next-line
  '/channels/:channel+': {
    message: { type: 'event' };
  };
}>;
```

If you need to escape a colon in the path, use two backslashes before the `:` (`\\:`).

```ts
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  // Only `:roomId` is a path parameter
  // highlight-next-line
  '/rooms/:roomId\\:/live': {
    message: { type: 'message' };
  };
}>;
```

:::tip TIP: <span>Escaped colons in URLs</span>

In actual URLs, do not include the backslashes. They are only used to escape the colon in the type definition.

:::

## Declaring messages

Each path can have a `message` property, which defines the messages that both the server and the clients connected to that path send. Declare multiple messages as a union.

```ts
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    // highlight-next-line
    message: { type: 'message'; data: { text: string } } | { type: 'typing'; data: { username: string } };
  };
}>;
```

### Declaring message directions

Messages that only one side sends are declared in the `serverMessage` and `clientMessage` properties. The server sends `message` and `serverMessage`, and clients send `message` and `clientMessage`. All three properties are optional, and a path without any of them has no messages.

```ts
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    // Sent by the server and the clients
    message: { type: 'typing'; data: { username: string } };
    // Sent only by the server
    // highlight-next-line
    serverMessage: { type: 'presence'; data: { username: string; online: boolean } };
    // Sent only by the clients
    // highlight-next-line
    clientMessage: { type: 'message'; data: { text: string } };
  };
}>;
```

### Supported message data

`message` accepts values compatible with native WebSocket message data:

- JSON-compatible values
- `string`
- [`Blob`](https://developer.mozilla.org/docs/Web/API/Blob)
- [`BufferSource`](https://developer.mozilla.org/docs/Web/API/BufferSource)

Messages that are not strings or binary data are sent as JSON text. Top-level `null` is not a valid message.

JSON-compatible messages are the most common choice when using Zimic with [`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md), because they let handlers type parsed message objects.

```ts
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/files': {
    // highlight-next-line
    message: { type: 'upload'; data: { name: string } } | Blob;
  };
}>;
```

### `WebSocketMessageData`

[`WebSocketMessageData`](/docs/zimic-ws/api/1-websocket-schema.md#websocketmessagedata) represents the data passed to `send()` and received in message events for a message type. To get the messages of a path, use [`WebSocketSchemaMessage`](/docs/zimic-ws/api/1-websocket-schema.md#websocketschemamessage-1). To get only the messages one side sends, use [`WebSocketSchemaMessage.Server`](/docs/zimic-ws/api/1-websocket-schema.md#websocketschemamessageserver) or [`WebSocketSchemaMessage.Client`](/docs/zimic-ws/api/1-websocket-schema.md#websocketschemamessageclient).

JSON-compatible messages become their stringified representation. `string`, `Blob`, and `BufferSource` messages keep the same type.

```ts
import { WebSocketMessageData, WebSocketSchemaMessage } from '@zimic/ws';

import { ChatSchema } from './schema';

type ChatMessage = WebSocketSchemaMessage<ChatSchema, '/rooms/:roomId'>;

const message: WebSocketMessageData<ChatMessage> = JSON.stringify({
  type: 'typing',
  data: { username: 'diego' },
});
```

## Declaring connections

Each path can have a `connection` property, which defines the handshake of the connections to that path. Search params and subprotocols not declared in the schema are type errors in [`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md) connection handlers.

### Declaring connections with search params

Search parameters (query) of the connection URL are declared in the `searchParams` property.

```ts
import { WebSocketSchema } from '@zimic/ws';

interface RoomSearchParams {
  token: string;
  limit?: `${number}`;
}

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: {
      // highlight-next-line
      searchParams: RoomSearchParams;
    };
    message: { type: 'message'; data: { text: string } };
  };
}>;
```

### Declaring connections with subprotocols

The subprotocols that clients can request are declared in the `protocols` property, as a union of strings.

```ts
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: {
      // highlight-next-line
      protocols: 'chat' | 'json';
    };
    message: { type: 'message'; data: { text: string } };
  };
}>;
```

## Using schemas with clients

Pass the schema as a type argument when creating a [`WebSocketClient`](/docs/zimic-ws/api/2-websocket-client.mdx). The second type argument is the path the client connects to, which types the messages it sends and receives. The client sends `message` and `clientMessage`, and receives `message` and `serverMessage`. The path is optional if the schema has a single path. If the schema has multiple paths, omitting it is a type error.

```ts
import { WebSocketClient } from '@zimic/ws';

import { ChatSchema } from './schema';

const client = new WebSocketClient<ChatSchema, '/rooms/:roomId'>('ws://localhost:3000/rooms/1?token=secret', 'chat');

await client.open();

client.send(JSON.stringify({ type: 'typing', data: { username: 'diego' } }));
```

:::tip TIP: <span>URLs are not checked</span>

URLs are plain strings, so they are not checked against the path type argument or the connection schema.

:::

## Using schemas with servers

Pass the same schema to [`WebSocketServer`](/docs/zimic-ws/api/3-websocket-server.mdx) to type clients accepted by the server. A server accepts connections to any path of its schema, so its clients are typed with the messages of all paths. Each client of the server sends `message` and `serverMessage`, and receives `message` and `clientMessage`.

```ts
import { createServer } from 'node:http';
import { WebSocketServer } from '@zimic/ws/server';

import { ChatSchema } from './schema';

const httpServer = createServer();
const server = new WebSocketServer<ChatSchema>({ httpServer });

server.addEventListener('connection', (client) => {
  client.send(JSON.stringify({ type: 'presence', data: { online: true } }));
});

httpServer.listen(3000, '127.0.0.1');
await server.open();
```
