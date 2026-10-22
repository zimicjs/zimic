# @zimic/ws

- `WebSocketClient` follows the native `WebSocket`, and `WebSocketServer` follows the `WebSocketServer` of the `ws` package.
- The `.` entry point (`src/index.ts`) exports the client, schema types, and errors and must stay browser-safe. The `./server` entry point (`src/server`) is Node-only.
