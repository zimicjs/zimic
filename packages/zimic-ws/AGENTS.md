# @zimic/ws

- The `.` entry point (`src/index.ts`) exports the client, schema types, and errors and must stay browser-safe. The `./server` entry point (`src/server`) is Node-only.
- `@zimic/interceptor` declares this package as a peer dependency and builds its WebSocket interceptors on its schema, client, and server types. When changing them, type check and test the WebSocket parts of `@zimic/interceptor`.
- Website pages for this package belong in `apps/zimic-web/docs/zimic-ws` (routes `/docs/ws/*`), following the layout of the other packages.
