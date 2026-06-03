# Zimic - Agent Guide

## Project overview

- TypeScript monorepo for HTTP and WebSocket tooling, including schema, fetch, interceptor, and utility packages.
- Public APIs are published from package entry points and treated as stable contracts.
- Documentation lives in the website app (`apps/zimic-web`), and runnable integrations live under `examples`.

## Public API and packaging

- Treat package exports as part of the public contract. If a change adds, removes, or renames a public entry point, keep
  the package `exports` map and consumer coverage aligned.
- Preserve tree-shakeability. Avoid top-level side effects and do not weaken assumptions behind package
  `sideEffects: false`.
- In `@zimic/utils`, keep public utilities granular. Follow the existing one-entry-per-export structure instead of
  folding new utilities into broad entry points.

## Runtime and behavior coverage

- Many packages are expected to work in both Node and browser environments. Keep changes runtime-safe unless the target
  code is clearly environment-specific.
- `@zimic/interceptor` has local and remote implementations behind shared APIs. Changes that affect shared behavior
  should account for both modes.
- Match the test dimensions already used by the target package. Cover every affected runtime or mode instead of testing
  only the easiest path.
- Do not weaken coverage expectations for core packages.

## Implementation conventions

- Before changing a module, review analogous modules in the same package and follow their structure, naming, data flow,
  and error-handling patterns unless there is a clear reason to diverge.
- Prefer type-safe designs over broad unions, loose public/internal type mixing, or casts. If narrowing is unavoidable,
  keep it isolated behind a small, named boundary that reflects a real runtime guarantee.
- Avoid reaching through public wrappers into internal implementation details from production code unless that is
  already the established internal contract for the module.

## Testing conventions

- Write tests from the point of view of a user of the public API whenever possible. Avoid asserting implementation
  details unless the nearby test suite already does so for that layer.
- When adding tests for a module with a close analogue, mirror the analogue's test file split, shared test modules,
  describe blocks, and test-case naming. Keep equivalent behaviors easy to compare across modules.
- Avoid one-off test helper functions. Add a helper only when it matches an existing test pattern or removes meaningful
  repeated setup without hiding the behavior under test.

## Published artifacts

- Do not hand-edit generated declaration files, except top-level entry points that are intentionally kept in source
  control.
- Update docs and examples when a public API or documented behavior changes.
- Treat breaking public API changes as intentional work. Keep code, tests, exports, and docs consistent.

## Before finishing a change

Run these in the relevant app or package, in this order:

1. Type check
2. Lint
3. Test

Review the project scripts and documentation before running project-specific commands. Do not try to guess or run ad-hoc
commands without context. If unclear, ask the user.

Prefer targeted checks over full-workspace runs.

After editing a shared package, rebuild it before exercising services that depend on it. Never edit generated build
output directly.

## Where to look first

- General project structure and setup: root `README.md`, `CONTRIBUTING.md`, and workspace configuration.
- App or package-specific conventions and commands: local `README.md` and package scripts.
- Existing nearby tests and implementation patterns before introducing new helpers or abstractions.
