# @zimic/ws

- `WebSocketClient` follows the native `WebSocket`, and `WebSocketServer` follows the `WebSocketServer` of the `ws` package. Approved `WebSocketClient` divergences:
  - A client created from a URL does not connect until `open()`, so it can be configured and reopened.
  - `open()` and `close()` are async and accept timeouts, so callers can await each connection change.
  - Listeners receive the `WebSocketClient` as `this`, so they use its schema types.
- The `.` entry point (`src/index.ts`) exports the client, schema types, and errors and must stay browser-safe. The `./server` entry point (`src/server`) is Node-only.
