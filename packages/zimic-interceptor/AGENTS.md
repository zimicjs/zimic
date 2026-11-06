# @zimic/interceptor

## Modes and platforms

- HTTP interceptors (`src/http`) and WebSocket interceptors (`src/ws`) each have local and remote implementations behind shared APIs, and both run in Node and browser. Account for every protocol, mode, and platform a shared change touches.
- Remote interceptors depend on the interceptor server in `src/server`, which the `zimic-interceptor server` CLI in `src/cli` also exposes. Users must run interceptors and servers on the same version. Change both sides of the protocol in the same commit, without fallbacks for older peers. Bump `INTERCEPTOR_SERVER_RPC_VERSION` in `src/interceptor/constants.ts` only for changes that break communication with the previous version, and release the bump as a minor change, not a breaking one.

## HTTP and WebSocket parity

WebSocket interceptors follow the mental model of HTTP interceptors. Keep these consistent between `src/http` and `src/ws`:

- Lifecycle contracts: starting, stopping, running state, clearing, and checking expectations.
- Handler precedence and matching order.
- Restriction concepts.
- `times` semantics.
- Saving controls for intercepted requests and messages.
- Error classes, messages, and the conditions that throw them.
- Test organization: `<Class>.<topic>.{node,browser}.test.ts` files that run shared cases from `__tests__/shared/<topic>.ts`, with matching describe blocks and test names. Type tests are the exception, as stated under Testing.

Local and remote interceptors behave identically for routing, fall-through, and unhandled strategies. Diverge only for a platform constraint such as MSW's URL handling, and state it next to the code.

Diverge between protocols only for a protocol reason, such as WebSocket connections being long-lived and bidirectional. State that reason in a comment next to the divergent code, and in the docs when users can observe the difference.

## Testing

- Interceptor suites test behavior through the interceptor. Handler suites test the handler contract: matching, restrictions, times, clearing, saved entries, types, and promise-like remote handlers, as the HTTP request handler suites do.
- Test parity applies at both levels and to every handler kind. When adding or changing a suite, compare it in both directions with each counterpart:
  - Interceptor suites: `HttpInterceptor` and `WebSocketInterceptor`, including the connection cases in WebSocket interceptor topics.
  - Handler suites: `HttpRequestHandler`, `WebSocketMessageHandler`, and `WebSocketConnectionHandler`. `HttpRequestHandler` is the reference when they differ.
- Add each scenario that applies to a counterpart to that counterpart in the same change, at the same level and in the same topic file. The root rule to cover a scenario once applies within one class and level, so it does not exempt a counterpart.
- Otherwise, state why the scenario does not apply in a comment in the suite, one per counterpart title or `describe` group: `// No <Protocol> counterpart for "<counterpart title>": <protocol reason>.` Between WebSocket handlers, use `WebSocket message` or `WebSocket connection` as `<Protocol>`. Coverage in another suite is not a protocol reason.
- Translate test names by swapping only protocol nouns: `requests`, `messages`, or `connections`. Interceptor suites say "intercept" and handler suites say "match", in both protocols and for both WebSocket handlers.
- Keep counterpart tests in the same order and `describe` groups, and place each no-counterpart comment where the counterpart would be. A test of one rule per title takes priority over copying a counterpart that joins several.
- Limit server tests in `src/server/__tests__` to scenarios the CLI and remote interceptor tests cannot reach.
- Keep the same concept under the same topic name in both protocols. Map renamed topics explicitly: `requestSaving`/`messageSaving`, `unhandledRequests`/`unhandledMessages`, `bodies`/`messageData`. Give a protocol-only concept its own topic, such as `connections`, `sends`, or `effects`, instead of reusing a counterpart topic name.
- Manage interceptors, workers, and clients with the `using*` utilities in `tests/utils`. Add the protocol counterpart of a utility when it is missing.
- Chain handler declarations and await the chain once instead of awaiting a bare handler.
- Keep type tests compile-only, without executing their callbacks, and place them inline in one `<Class>.types.node.test.ts`, without a browser file or a shared module of type test cases. `tsc` checks them once regardless of platform, and coverage excludes test files.

## API reference

- Mirror the structure, headings, and examples of HTTP reference pages and guides in their WebSocket counterparts.
- Match the JSDoc of WebSocket declarations to their HTTP counterparts. Keep the experimental notice on WebSocket public entry points while the API is experimental.
