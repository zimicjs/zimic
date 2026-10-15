# @zimic/fetch

- Keep the client minimal: no runtime dependencies, and APIs that mirror the native `fetch`, `Request`, and `Response` they type.
- `@zimic/http` is a peer dependency. Reuse its schema and HTTP types instead of redeclaring them.
- Tests mock requests with `@zimic/interceptor` in Node and browser. Run the `setup` script before running browser tests.
