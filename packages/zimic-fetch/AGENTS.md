# @zimic/fetch

- `fetch`, `FetchRequest`, and `FetchResponse` follow the native `fetch`, `Request`, and `Response`. Approved divergences:
  - Paths resolve against the required `baseURL`, so inputs can be typed as schema paths.
  - `init.method` is required for path and URL inputs, so the schema can type each request by method.
  - Instance defaults, including `searchParams`, merge into every request.
  - `FetchRequest` takes the fetch instance first and `FetchResponse` takes its request first, to bind them to the client. `fetch.Request` hides the fetch argument.
- Add no runtime `dependencies`. `@zimic/http` is the only runtime peer dependency. Reuse its schema types and helpers instead of redeclaring them.
- Tests mock requests with `@zimic/interceptor` in Node and browser. Run the `setup` script before running browser tests.
