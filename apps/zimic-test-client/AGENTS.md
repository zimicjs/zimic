# zimic-test-client

This app depends on the workspace `@zimic/*` packages and imports them like a consumer, through their `exports` maps, so it runs against their build output. Rebuild every changed package before running its tests.

- When a public entry point or export changes, update the export checks in `tests/exports`: `exports.test.ts` for entry points that run in Node and browser, and `exports.node.test.ts` for Node-only entry points such as `@zimic/http/typegen`, `@zimic/interceptor/server`, and `@zimic/ws/server`. Keep one describe block per package, assert runtime values for value exports, and use `expectTypeOf` for type-only exports.
- `tests/interceptor/thirdParty` runs interceptor scenarios against real HTTP clients, with shared cases in `thirdParty/shared`. Add protocol scenarios there as shared cases run by each client's test files.
- The `test` script starts an ephemeral interceptor server on port 4000 for remote interceptor tests.
