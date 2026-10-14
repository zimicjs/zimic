# @zimic/fetch

- Keep the client minimal: no runtime dependencies, and APIs that mirror the native `fetch`, `Request`, and `Response` they type.
- `@zimic/http` is a peer dependency. Reuse its schema and HTTP types instead of redeclaring them.
- Tests mock requests with `@zimic/interceptor` in Node and browser. The `setup` script installs the browser and the mock service worker they need.
- API reference pages live in `apps/zimic-web/docs/zimic-fetch/api` (routes `/docs/fetch/api/*`) and guides in `apps/zimic-web/docs/zimic-fetch/guides`.
