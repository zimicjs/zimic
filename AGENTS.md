# Zimic - Agent Guide

## Project overview

- TypeScript monorepo for HTTP and WebSocket tooling, including schema, fetch, interceptor, and utility packages.
- APIs from packages intended for direct external use are stable contracts. Internal packages such as `@zimic/utils` may evolve with their consumers.
- Documentation lives in the website app (`apps/zimic-web`), and runnable integrations live under `examples`.

## Public API and packaging

- For packages intended for direct external use, treat package exports as part of the public contract. Keep the `exports` map and consumer coverage aligned when adding, removing, or renaming an entry point. Do not require public compatibility or consumer export tests for internal packages such as `@zimic/utils`.
- Preserve tree-shakeability. Avoid top-level side effects and do not weaken assumptions behind package `sideEffects: false`.

## Native API parity

`@zimic/http`, `@zimic/fetch`, and `@zimic/ws` emulate native APIs. Their `AGENTS.md` files name the reference APIs and list approved divergences.

- Keep the names, signatures, defaults, errors, and behavior of native members. Change their types only to narrow them through the schema.
- Add capabilities as new members or options that leave native behavior unchanged.
- Diverge from native behavior only with explicit user approval. Add the divergence to the package's approved list, state the reason in a comment next to the code, and document it in the website docs.
- Check parity against the WHATWG specs, MDN, and TypeScript `lib.dom` declarations, or against the reference package that the package's `AGENTS.md` names.
- When adding or changing a member with a native counterpart, add type tests proving the class is assignable to the native type and runtime tests asserting the native behavior.
- `@zimic/interceptor` interceptor and handler APIs may favor test ergonomics. The requests, responses, headers, search params, and form data it exposes keep native parity.

## Public JSDoc

These rules apply to packages intended for direct external use.

- Write JSDoc for every public export and its public members, including re-exported declarations, overloads, option fields, and types reachable through public signatures even when not exported by name. Audit all of them when adding or changing a public API.
- When an existing page or section of the website docs covers the resource, write a concise `@see {@link https://zimic.dev/docs/<route>#<anchor> <label>}` to the closest one instead of copying its explanation. Describe the resource inline when no suitable page or section exists.
- Take routes from the `slug` frontmatter of pages under `apps/zimic-web/docs` and anchors from their headings. Update the JSDoc links in the same change when a route or heading moves.

## Runtime and behavior coverage

- Many packages are expected to work in both Node and browser environments. Keep changes runtime-safe unless the target code is clearly environment-specific.
- Match the test dimensions already used by the target package.
- Do not weaken coverage expectations for core packages.

## Implementation conventions

- Before changing a module, review analogous modules in the same package and follow their structure, naming, data flow, and error-handling patterns unless there is a clear reason to diverge.
- Prefer type-safe designs over broad unions, loose public/internal type mixing, or casts. If narrowing is unavoidable, keep it isolated behind a small, named boundary that reflects a real runtime guarantee.
- Avoid reaching through public wrappers into internal implementation details from production code unless that is already the established internal contract for the module.
- Published packages include `@zimic/utils/types/globals`, which narrows built-ins such as `Object.keys`. Rely on those types instead of casting.
- Create deferred promises with `createPromiseWithResolvers` from `@zimic/utils/data` instead of `Promise.withResolvers`, which older supported runtimes lack.
- Do not add production code that only tests reach, such as optional parameters with fallbacks, unreachable guards, or unused members kept for symmetry. Delete unreachable branches instead of covering them.
- Treat each `await` between a check and the state change it guards as a race window. Reserve state before awaiting, account for concurrent start, stop, and clear calls, and reset pending-operation state in `finally`.
- Validate untrusted payloads completely before changing any state.
- Before reporting a feature complete, check every requirement in its linked issue against the implementation.

## Testing conventions

- Test through the public API. Do not unit-test an internal module, or read private state through casts, when a public path reaches the behavior.
- When a scenario cannot be reached publicly, inject the fault at one narrow boundary, comment on why no public path triggers it, and assert the resulting public outcome.
- Mock only boundaries the project does not own, such as platform APIs, timers, randomness, or missing peer dependencies. Control time with fake timers instead of waiting in real time or measuring elapsed time.
- Make each test prove its name with an outcome a user can observe. Synchronize on that observable state, not on intermediate internal callbacks.
- Run every applicable case in every mode and runtime of the test matrix. Do not skip cases through conditionals or optional options; place a case that genuinely applies to one mode or runtime only in that mode's or runtime's file.
- When adding tests for a module with a close analogue, mirror the analogue's test file split, shared test modules, describe blocks, and test-case naming. Keep equivalent behaviors easy to compare across modules.
- Cover each scenario once, at one level, in the file where the closest analogue keeps it. Keep one behavior per test and one top-level `describe` per file. Use `it.each` instead of branching inside a test.
- Search existing shared test utilities before writing a helper. Add a helper only when it matches an existing test pattern or removes meaningful repeated setup without hiding the behavior under test. Place helpers used by several modules in a shared location, not inside one module's tests.

## Published artifacts

- Do not hand-edit generated declaration files, except top-level entry points that are intentionally kept in source control.
- Update docs and examples when a user-facing public API or documented behavior changes.
- Treat breaking public API changes as intentional work. Keep code, tests, exports, and docs consistent.

## Before finishing a change

Run these in the relevant app or package, in this order:

1. Type check
2. Lint
3. Test

Review the project scripts and documentation before running project-specific commands. Do not try to guess or run ad-hoc commands without context. If unclear, ask the user.

Prefer targeted checks over full-workspace runs.

After editing a shared package, rebuild it before exercising services that depend on it. Never edit generated build output directly.

## Issues

- File bug issues with the sections of `.github/ISSUE_TEMPLATE/bug-report.yaml` in order, with System information from its `envinfo` command and a reproduction that was run against a published version.

## Where to look first

- General project structure and setup: root `README.md`, `CONTRIBUTING.md`, and workspace configuration.
- App, package, and example contracts: directories with their own `AGENTS.md` add scoped rules. Read the nearest one before changing files there.
- App or package-specific commands: local `README.md` and package scripts.
- Existing nearby tests and implementation patterns before introducing new helpers or abstractions.
