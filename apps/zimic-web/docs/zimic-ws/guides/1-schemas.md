---
title: Declaring schemas | @zimic/ws
sidebar_label: Schemas
slug: /ws/guides/schemas
---

# Declaring schemas

WebSocket schemas describe the message data your WebSocket connection can send and receive. They are declared with the
[`WebSocketSchema`](/docs/zimic-ws/api/1-websocket-schema.md) type exported by `@zimic/ws`.

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type ChatMessage =
  | { type: 'message'; data: { text: string } }
  | { type: 'typing'; data: { username: string } }
  | { type: 'presence'; data: { online: boolean } };

export type ChatSchema = WebSocketSchema<ChatMessage>;
```

## Supported message data

`WebSocketSchema` accepts values compatible with native WebSocket message data:

- JSON-compatible values
- `string`
- `Blob`
- `BufferSource`

JSON-compatible schemas are the most common choice when using Zimic with
[`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md), because they let handlers type parsed message objects.

```ts
import { WebSocketSchema } from '@zimic/ws';

type NotificationSchema = WebSocketSchema<{
  type: 'notification';
  data: {
    id: string;
    read: boolean;
  };
}>;
```

## `WebSocketMessageData`

[`WebSocketMessageData`](/docs/zimic-ws/api/1-websocket-schema.md#websocketmessagedata) represents the data passed to
`send()` and received in message events for a schema.

For JSON-compatible schemas, the message data is the stringified representation of the schema. For `string`, `Blob`, and
`BufferSource` schemas, the data keeps the same type.

```ts
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{ type: 'ping'; data: { id: string } }>;

const message: WebSocketMessageData<Schema> = JSON.stringify({
  type: 'ping',
  data: { id: '1' },
});
```

## Using schemas with clients

Pass the schema as a type argument when creating a [`WebSocketClient`](/docs/zimic-ws/api/2-websocket-client.mdx).

```ts
import { WebSocketClient } from '@zimic/ws';

import { ChatSchema } from './schema';

const client = new WebSocketClient<ChatSchema>('ws://localhost:3000/chat');

client.send(JSON.stringify({ type: 'typing', data: { username: 'diego' } }));
```

## Using schemas with servers

Pass the same schema to [`WebSocketServer`](/docs/zimic-ws/api/3-websocket-server.mdx) to type clients accepted by the
server.

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

## Using schemas with interceptors

Experimental WebSocket interceptors from `@zimic/interceptor/experimental/ws` use `WebSocketSchema` to type message
handlers, restrictions, responses, saved messages, connected clients, and server sends.

```ts
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

import { ChatSchema } from './schema';

const interceptor = createWebSocketInterceptor<ChatSchema>({
  baseURL: 'ws://localhost:3000/chat',
});
```

**Related**:

- [API - `WebSocketSchema`](/docs/zimic-ws/api/1-websocket-schema.md)
- [Interceptor guides - WebSocket interceptors](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md)
