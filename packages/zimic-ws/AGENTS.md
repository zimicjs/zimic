# @zimic/ws

- `WebSocketClient` follows the native `WebSocket`, and `WebSocketServer` follows the `WebSocketServer` of the `ws` package. Approved divergences:
  - The client constructor does not connect. `open()` and an async `close()` accept timeouts and reject with timeout errors, and a closed client can reopen.
  - The client constructor accepts an existing socket, to wrap server-side connections.
  - Client listeners receive the `WebSocketClient` as `this`.
  - The server attaches to an existing `http` or `https` server, exposes only the `connection`, `error`, `listening`, and `close` events, opens and closes asynchronously with timeouts, and passes `WebSocketClient` instances to `connection` listeners.
- The `.` entry point (`src/index.ts`) exports the client, schema types, and errors and must stay browser-safe. The `./server` entry point (`src/server`) is Node-only.
- `@zimic/interceptor` declares this package as a peer dependency and builds its WebSocket interceptors on its schema, client, and server types. When changing them, type check and test the WebSocket parts of `@zimic/interceptor`.
