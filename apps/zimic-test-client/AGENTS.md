# zimic-test-client

This app depends on the workspace `@zimic/*` packages and imports them like a consumer, through their `exports` maps, so it runs against their build output. Rebuild every changed package before running its tests.

- When a public entry point or export changes, update the export checks in `tests/exports`. Node-only entry points go in the `.node` test file.
- `tests/interceptor/http` and `tests/interceptor/webSocket` run interceptor scenarios against real clients, with shared cases in each `shared/` directory. Add protocol scenarios there as shared cases run by each client's test files.
- The `test` script starts its own interceptor server for remote interceptor tests. Do not start one separately.
