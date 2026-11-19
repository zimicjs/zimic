---
title: WebSocketSchema | @zimic/ws
sidebar_label: WebSocketSchema
slug: /ws/api/websocket-schema
---

# `WebSocketSchema`

Declares the schema of a WebSocket service.

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: { searchParams: { token: string }; protocols: 'chat' | 'json' };
    message: { type: 'message'; data: { text: string } } | { type: 'typing'; data: { username: string } };
  };
}>;
```

**Related**:

- [Guides - Declaring schemas](/docs/zimic-ws/guides/1-schemas.md)

## `WebSocketSchema.Path`

Declares the connection and message schemas of a path in a WebSocket service.

```ts
type WebSocketSchema.Path<PathSchema>
```

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type RoomPath = WebSocketSchema.Path<{
  message: { type: 'message'; data: { text: string } };
}>;

type Schema = WebSocketSchema<{
  '/rooms/:roomId': RoomPath;
}>;
```

## `WebSocketSchema.Connection`

Declares a connection schema in a WebSocket service.

```ts
type WebSocketSchema.Connection<ConnectionSchema>
```

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type RoomConnection = WebSocketSchema.Connection<{
  searchParams: { token: string };
  protocols: 'chat' | 'json';
}>;

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: RoomConnection;
    message: { type: 'message'; data: { text: string } };
  };
}>;
```

## `WebSocketSchema.Message`

Declares a message schema in a WebSocket service.

```ts
type WebSocketSchema.Message<MessageSchema>
```

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type RoomMessage = WebSocketSchema.Message<
  { type: 'message'; data: { text: string } } | { type: 'typing'; data: { username: string } }
>;

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    message: RoomMessage;
  };
}>;
```

## `WebSocketSchema.SearchParams`

Declares a search params schema in a WebSocket service.

```ts
type WebSocketSchema.SearchParams<SearchParamsSchema>
```

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type RoomSearchParams = WebSocketSchema.SearchParams<{
  token: string;
  limit?: `${number}`;
}>;

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: { searchParams: RoomSearchParams };
    message: { type: 'message'; data: { text: string } };
  };
}>;
```

## `WebSocketSchema.PathParams`

Declares a path params schema in a WebSocket service.

```ts
type WebSocketSchema.PathParams<PathParamsSchema>
```

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

type RoomPathParams = WebSocketSchema.PathParams<{
  roomId: string;
}>;
```

## `WebSocketSchemaPath`

Extracts the [literal](#websocketschemapathliteral) and [non-literal](#websocketschemapathnonliteral) paths from a WebSocket service schema.

```ts
type WebSocketSchemaPath<Schema>
```

```ts
import { WebSocketSchema, WebSocketSchemaPath } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/notifications': {
    message: { type: 'notification'; data: { id: string } };
  };
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

type Path = WebSocketSchemaPath<Schema>;
// "/notifications" | "/rooms/:roomId" | "/rooms/${string}"
```

### `WebSocketSchemaPath.Literal`

Extracts the literal paths from a WebSocket service schema.

```ts
type WebSocketSchemaPath.Literal<Schema>
```

```ts
import { WebSocketSchema, WebSocketSchemaPath } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/notifications': {
    message: { type: 'notification'; data: { id: string } };
  };
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

type LiteralPath = WebSocketSchemaPath.Literal<Schema>;
// "/notifications" | "/rooms/:roomId"
```

### `WebSocketSchemaPath.NonLiteral`

Extracts the non-literal paths from a WebSocket service schema.

```ts
type WebSocketSchemaPath.NonLiteral<Schema>
```

```ts
import { WebSocketSchema, WebSocketSchemaPath } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/notifications': {
    message: { type: 'notification'; data: { id: string } };
  };
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

type NonLiteralPath = WebSocketSchemaPath.NonLiteral<Schema>;
// "/notifications" | "/rooms/${string}"
```

## `LiteralWebSocketSchemaPathFromNonLiteral`

Finds the literal path of a WebSocket service schema that a non-literal path belongs to. If more than one literal path matches, the most static one takes precedence.

```ts
type LiteralWebSocketSchemaPathFromNonLiteral<Schema, NonLiteralPath>
```

```ts
import { LiteralWebSocketSchemaPathFromNonLiteral, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/lobby': {
    message: { type: 'announcement'; data: { text: string } };
  };
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

type RoomPath = LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/rooms/1'>;
// "/rooms/:roomId"

type LobbyPath = LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/rooms/lobby'>;
// "/rooms/lobby"
```

## `InferPathParams`

Infers the path params schema from a path string. If the first argument is a schema, the second argument should be a valid path in that schema. See [Declaring paths](/docs/zimic-ws/guides/1-schemas.md#declaring-paths) for more details on how to declare path params.

```ts
type InferPathParams<Path>
type InferPathParams<Schema, Path>
```

```ts
import { InferPathParams } from '@zimic/ws';

// Inferring path parameters from a standalone path string:
type PathParams = InferPathParams<'/rooms/:roomId'>;
// { roomId: string }
```

```ts
import { InferPathParams, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

// Using a schema to validate the path:
type PathParams = InferPathParams<Schema, '/rooms/:roomId'>;
// { roomId: string }
```

## `WebSocketSchemaMessage`

Extracts the message schema of a path in a WebSocket service schema. If the path is a union or is omitted, the result is the union of the messages of each path.

```ts
type WebSocketSchemaMessage<Schema>
type WebSocketSchemaMessage<Schema, Path>
```

```ts
import { WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/notifications': {
    message: { type: 'notification'; data: { id: string } };
  };
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

type RoomMessage = WebSocketSchemaMessage<Schema, '/rooms/:roomId'>;
// { type: 'message'; data: { text: string } }

type Message = WebSocketSchemaMessage<Schema>;
// { type: 'notification'; data: { id: string } } | { type: 'message'; data: { text: string } }
```

## `WebSocketPathSchema`

The base type of the path schemas in a `WebSocketSchema`. Each path declares a required `message`, with a [`WebSocketMessageSchema`](#websocketmessageschema), and an optional `connection`, with a [`WebSocketConnectionSchema`](#websocketconnectionschema).

```ts
interface WebSocketPathSchema {
  connection?: WebSocketConnectionSchema;
  message: WebSocketMessageSchema;
}
```

## `WebSocketConnectionSchema`

The base type of the connection schemas in a `WebSocketSchema`. A connection declares the search params accepted in the connection URL and the subprotocols that clients can request, as a union of strings. Search params and subprotocols not declared in the schema are type errors.

```ts
interface WebSocketConnectionSchema {
  searchParams?: HttpSearchParamsSchema.Loose;
  protocols?: string;
}
```

## `WebSocketMessageSchema`

The base type of the message schemas in a `WebSocketSchema`. Messages can be JSON-compatible values, `string`, `Blob`, or `BufferSource`. Messages that are not strings or binary data are sent as JSON text. Top-level `null` is not a valid message.

```ts
type WebSocketMessageSchema = Exclude<JSONValue.Loose, null | undefined> | Blob | BufferSource;
```

## `WebSocketConnectionSearchParamsSchema`

Extracts the search params schema of the connections to a path. Resolves to `never` if the path declares no search params.

```ts
type WebSocketConnectionSearchParamsSchema<PathSchema>
```

```ts
import { WebSocketConnectionSearchParamsSchema, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: { searchParams: { token: string } };
    message: { type: 'message'; data: { text: string } };
  };
}>;

type RoomSearchParams = WebSocketConnectionSearchParamsSchema<Schema['/rooms/:roomId']>;
// { token: string }
```

## `WebSocketConnectionProtocolSchema`

Extracts the subprotocols of the connections to a path. Resolves to `never` if the path declares no subprotocols.

```ts
type WebSocketConnectionProtocolSchema<PathSchema>
```

```ts
import { WebSocketConnectionProtocolSchema, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: { protocols: 'chat' | 'json' };
    message: { type: 'message'; data: { text: string } };
  };
}>;

type RoomProtocol = WebSocketConnectionProtocolSchema<Schema['/rooms/:roomId']>;
// "chat" | "json"
```

## `WebSocketMessageData`

Converts a message schema to the data sent and received through a socket. JSON-compatible messages become their stringified representation. `string`, `Blob`, and `BufferSource` messages keep their original type. To get the messages of a path in a schema, use [`WebSocketSchemaMessage`](#websocketschemamessage).

```ts
type WebSocketMessageData<MessageSchema>
```

```ts
import { WebSocketMessageData } from '@zimic/ws';

type Message = { type: 'ping'; data: { id: string } };

const message: WebSocketMessageData<Message> = JSON.stringify({
  type: 'ping',
  data: { id: '1' },
});
```

```ts
import { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

type RoomMessageData = WebSocketMessageData<WebSocketSchemaMessage<Schema, '/rooms/:roomId'>>;
```
