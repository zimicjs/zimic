---
title: WebSocketSchema | @zimic/ws
sidebar_label: WebSocketSchema
slug: /ws/api/websocket-schema
---

# `WebSocketSchema`

Declares the message data schema of a WebSocket connection.

```ts
type WebSocketSchema<Schema>
```

```ts title='schema.ts'
import { WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<
  { type: 'message'; data: { text: string } } | { type: 'typing'; data: { username: string } }
>;
```

`Schema` can be a JSON-compatible value, `string`, `Blob`, or `BufferSource`.

**Related**:

- [Guides - Declaring schemas](/docs/zimic-ws/guides/1-schemas.md)

## `WebSocketMessageData`

Represents the message data sent and received by clients and servers typed with a WebSocket schema.

```ts
type WebSocketMessageData<Schema>
```

For JSON-compatible schemas, `WebSocketMessageData` is the stringified representation of the schema. For `string`,
`Blob`, and `BufferSource` schemas, it preserves the original type.

```ts
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{ type: 'ping'; data: { id: string } }>;

const message: WebSocketMessageData<Schema> = JSON.stringify({
  type: 'ping',
  data: { id: '1' },
});
```
