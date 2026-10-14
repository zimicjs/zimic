# @zimic/interceptor

## Modes and platforms

- HTTP interceptors (`src/http`) and WebSocket interceptors (`src/ws`) each have local and remote implementations behind shared APIs, and both run in Node and browser. Account for every protocol, mode, and platform a shared change touches.
- Remote interceptors depend on the interceptor server in `src/server`, which the `zimic-interceptor server` CLI in `src/cli` also exposes. Changes to remote behavior must keep the interceptor and server sides compatible.

## HTTP and WebSocket parity

WebSocket interceptors follow the mental model of HTTP interceptors. Keep these consistent between `src/http` and `src/ws`:

- Lifecycle contracts: starting, stopping, running state, clearing, and checking expectations.
- Handler precedence and matching order.
- Restriction concepts.
- `times` semantics and the errors reported when expectations are not met.
- Saving controls for intercepted requests and messages.
- Error classes, messages, and the conditions that throw them.
- Test organization: `<Class>.<topic>.{node,browser}.test.ts` files that run shared cases from `__tests__/shared/<topic>.ts`, with matching describe blocks and test names.

Diverge only for a protocol reason, such as WebSocket connections being long-lived and bidirectional. State that reason in a comment next to the divergent code, and in the docs when users can observe the difference.

## API reference

- HTTP reference pages live in `apps/zimic-web/docs/zimic-interceptor/api` (routes `/docs/interceptor/api/*`), HTTP guides in `apps/zimic-web/docs/zimic-interceptor/guides/http`, and CLI pages in `apps/zimic-web/docs/zimic-interceptor/cli`.
- Add WebSocket reference pages to the same `api` directory and WebSocket guides to `guides/ws`, mirroring the structure, headings, and examples of their HTTP counterparts.
- Match the JSDoc of WebSocket declarations to their HTTP counterparts. Where an HTTP declaration links to a page or section, link the WebSocket one to the matching WebSocket page or section. Keep the experimental notice on WebSocket public entry points while the API is experimental.
