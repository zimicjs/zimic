# @zimic/ws

- The `.` entry point (`src/index.ts`) exports the client, schema types, and errors and must stay browser-safe. The `./server` entry point (`src/server`) is Node-only.
- `@zimic/interceptor` declares this package as a peer dependency and builds its WebSocket interceptors on its schema, client, and server types. When changing them, type check and test the WebSocket parts of `@zimic/interceptor`.
- The website has no `@zimic/ws` pages yet. Describe public declarations inline in JSDoc. When pages are added under `apps/zimic-web/docs/zimic-ws`, follow the layout of the other packages and switch JSDoc to `@see` links.
