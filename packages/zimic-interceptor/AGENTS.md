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
- Test organization: `<Class>.<topic>.{node,browser}.test.ts` files that run shared cases from `__tests__/shared/<topic>.ts`, with matching describe blocks and test names.

Local and remote interceptors behave identically for routing, fall-through, and unhandled strategies. Diverge only for a platform constraint such as MSW's URL handling, and state it next to the code.

Diverge between protocols only for a protocol reason, such as WebSocket connections being long-lived and bidirectional. State that reason in a comment next to the divergent code, and in the docs when users can observe the difference.

## Testing

- Test behavior at the interceptor level. Limit handler suites to handler-only contracts, such as matching, clearing, and promise-like remote handlers, as the HTTP request handler suites do.
- Limit server tests in `src/server/__tests__` to scenarios the CLI and remote interceptor tests cannot reach.
- Keep the same concept under the same topic name in both protocols. Map renamed topics explicitly: `requestSaving`/`messageSaving`, `unhandledRequests`/`unhandledMessages`, `bodies`/`messageData`. Give a protocol-only concept its own topic, such as `connectionsAndSends` or `effects`, instead of reusing a counterpart topic name.
- When adding or changing a suite for one protocol, compare it with the counterpart suite in both directions. Add each scenario that applies to both protocols to both suites in the same change, or state the protocol reason for skipping it in a comment in the suite. Write that comment as `// No <Protocol> counterpart for "<counterpart title>": <protocol reason>.`, so parity audits can find it.
- Translate test names by swapping only protocol nouns. Interceptor suites say "intercept" and handler suites say "match" in both protocols.
- Keep counterpart tests in the same order and `describe` groups.
- Manage interceptors, workers, and clients with the `using*` utilities in `tests/utils`. Add the protocol counterpart of a utility when it is missing.
- Chain handler declarations and await the chain once instead of awaiting a bare handler.
- Keep type tests compile-only, without executing their callbacks, and place them in `__tests__/shared/types.ts`, which coverage excludes. When `types.ts` holds type tests, put the suite's shared schemas, options, and helpers in `__tests__/shared/utils.ts`.

## API reference

- Mirror the structure, headings, and examples of HTTP reference pages and guides in their WebSocket counterparts.
- Match the JSDoc of WebSocket declarations to their HTTP counterparts. Keep the experimental notice on WebSocket public entry points while the API is experimental.
