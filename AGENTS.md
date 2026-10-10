# Zimic - Agent Guide

## Project overview

- TypeScript monorepo for HTTP and WebSocket tooling, including schema, fetch, interceptor, and utility packages.
- APIs from packages intended for direct external use are stable contracts. Internal packages such as `@zimic/utils` may evolve with their consumers.
- Documentation lives in the website app (`apps/zimic-web`), and runnable integrations live under `examples`.

## Public API and packaging

- For packages intended for direct external use, treat package exports as part of the public contract. Keep the `exports` map and consumer coverage aligned when adding, removing, or renaming an entry point. Do not require public compatibility or consumer export tests for internal packages such as `@zimic/utils`.
- Preserve tree-shakeability. Avoid top-level side effects and do not weaken assumptions behind package `sideEffects: false`.
- Document every public declaration with JSDoc: package exports, re-exported declarations, public members, and types reachable through public signatures.
- For public API documentation, link to the closest existing or planned website documentation page when suitable. Otherwise, describe behavior inline. Align links with the documented route and keep HTTP and WebSocket documentation in parity where both protocols support the behavior.

## Runtime and behavior coverage

- Many packages are expected to work in both Node and browser environments. Keep changes runtime-safe unless the target code is clearly environment-specific.
- Match the test dimensions already used by the target package. Cover every affected runtime or mode instead of testing only the easiest path.
- Do not weaken coverage expectations for core packages.

## Implementation conventions

- Before changing a module, review analogous modules in the same package and follow their structure, naming, data flow, and error-handling patterns unless there is a clear reason to diverge.
- Prefer type-safe designs over broad unions, loose public/internal type mixing, or casts. If narrowing is unavoidable, keep it isolated behind a small, named boundary that reflects a real runtime guarantee.
- Avoid reaching through public wrappers into internal implementation details from production code unless that is already the established internal contract for the module.

## Testing conventions

- Write tests from the point of view of a user of the public API whenever possible. Avoid asserting implementation details unless the nearby test suite already does so for that layer.
- Avoid one-off test helper functions. Add a helper only when it matches an existing test pattern or removes meaningful repeated setup without hiding the behavior under test.

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

## Where to look first

- General project structure and setup: root `README.md`, `CONTRIBUTING.md`, and workspace configuration.
- Package and app contracts: the closest `AGENTS.md`; each scoped `CLAUDE.md` points to that guidance.
- Runnable example conventions: `examples/AGENTS.md`.
- Existing nearby tests and implementation patterns before introducing new helpers or abstractions.
