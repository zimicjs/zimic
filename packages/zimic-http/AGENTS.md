# @zimic/http

- Keep `HttpHeaders`, `HttpSearchParams`, and `HttpFormData` compatible with the native `Headers`, `URLSearchParams`, and `FormData` they type.
- The `.` entry point runs in Node and browser. The `./typegen` entry point and the `zimic-http` CLI (`src/cli`, `bin`) are Node-only.
- `@zimic/fetch` and `@zimic/interceptor` declare this package as a peer dependency and build on its schema types. When changing schema or request/response types, type check both consumers.
- Typegen tests compare against expected outputs in `src/cli/typegen/__tests__/fixtures`. Regenerate them with the `typegen:fixtures` script instead of editing them by hand.
