# Zimic AI Assistant Instructions

These instructions focus on project-specific architecture, workflows, and conventions so an AI agent can make correct,
minimal, high-quality changes fast.

## Big Picture

- Monorepo (pnpm + Turborepo) providing TypeScript-first HTTP integration libraries: `@zimic/http`, `@zimic/fetch`,
  `@zimic/interceptor`, plus internal `@zimic/utils` and supporting configuration packages. Documentation:
  `apps/zimic-web` (Docusaurus). A test consumer app: `apps/zimic-test-client`. Example integrations live under
  `examples/*`.
- Core flow: Define HTTP schemas (`@zimic/http`) -> consume via type-safe client (`@zimic/fetch`) -> mock/intercept real
  network calls locally or remotely (`@zimic/interceptor`). Utilities unify types and helpers.
- All public packages target Node >=20 and modern browsers; builds via `tsup` generate dual ESM/CJS outputs with
  explicit export maps and top-level `.d.ts` entry points.

## Key Directories

- `packages/zimic-http/src`: HTTP schema + typed wrappers (headers, params, form data) + typegen CLI
  (`bin: zimic-http`).
- `packages/zimic-fetch/src`: Minimal fetch-like client consuming schemas.
- `packages/zimic-interceptor/src`: Interceptor and worker logic (local and remote), request handlers, CLI
  (`bin: zimic-interceptor`), MSW + server integration (`server/*`, `http/*`, `webSocket/*`).
- `packages/zimic-utils/src`: Shared primitives (data comparison, URL building, wait utilities, logging, type helpers).
  Only import what you need to keep bundles small.
- `apps/zimic-web`: Docusaurus config (`docusaurus.config.ts` customized esbuild loader, Tailwind plugin) – do not break
  build assumptions (announcement bars, Algolia, prism themes).
- `apps/zimic-test-client`: Ensures install/build artifacts and server/browser interception work when consumed
  externally.
- `examples/*`: Treated as integration tests (different frameworks/toolchains); keep generated typegen files in sync (CI
  step diffing `examples/zimic-with-openapi-typegen/.../generated.ts`).

## Build and Task Workflow

- Root scripts wrap Turborepo tasks: `pnpm build` -> `turbo build`; `pnpm test` -> `turbo test:turbo`; `pnpm lint` ->
  `turbo lint:turbo`; `pnpm types:check` -> `turbo types:check`.
- Task graph (`turbo.json`): `dev` depends on parent `build` (no caching for watch); tests and type checks depend on
  builds to guarantee dist freshness.
- Package-level scripts often pair `test` (interactive) with `test:turbo` (CI + coverage). Coverage required to remain
  100% for core packages—never lower thresholds; add or adjust tests instead.
- Avoid editing generated declaration files (`index.d.ts`, `http.d.ts`, etc.); change source and rebuild.

## Testing Conventions

- Runner: Vitest (Node + `@vitest/browser` + Playwright). Browser tests need chromium via per-package `deps:prepare` /
  `deps:install-playwright` scripts.
- File layout: Source-near `__tests__` directories; test filenames: `Something.*.node.test.ts` /
  `Something.*.browser.test.ts` or combined patterns (e.g. `HttpInterceptor.unhandledRequests.browser.test.ts`). Shared
  parametrized suites live under `__tests__/shared/` and are invoked via helpers
  (`declareDefaultHttpRequestHandlerTests`, `declareMethodHttpInterceptorWorkerTests`). Extend by adding to the shared
  matrices rather than duplicating logic.
- Use environment matrices (`describe.each(testMatrix)`), avoid mocking internals; prefer exercising the public API of
  interceptors, workers, handlers. Only use spies when asserting side effects; keep test code close to tested module.
- All test helpers imported through path aliases like `@tests/utils/...` — maintain these when relocating files; ensure
  not exported in production bundles.

## Path and Build Constraints

- TypeScript config: `moduleResolution: bundler`, strict mode, incremental builds; do not introduce features requiring
  different module resolution without updating shared tsconfig.
- Exports are explicit; adding a new public module requires updating the `exports` map and (if needed) root type
  declarations. Keep tree-shakability: avoid side effects (respect `sideEffects: false`).
- Publishing filters exclude tests via negative globs in `files`. New folders must be added intentionally if meant for
  publish.

## Interceptor Architecture Notes

- Local vs remote interceptors/workers share test suites; ensure new behavior considers both modes
  (`promiseIfRemote(...)` pattern) and both platforms (Node vs browser).
- Remote mode may spin up an interceptor server; test helpers manage lifecycle (`createInternalInterceptorServer`,
  `startServer/stopServer` callbacks). Always await start/stop inside `beforeAll/afterAll` to keep test isolation.

## CLI Conventions

- Each package exposing a CLI uses `tsup` to build `dist/*.js` (with source maps) and declares a `bin` entry. Add new
  CLI commands inside the respective package; wire them through `yargs` with consistent option naming (kebab-case). Keep
  Node compatibility with declared engine.

## CI Expectations

- CI enforces: formatting style, typegen sync for OpenAPI example, lint + types, docs build, multi-Node version tests,
  multi-TypeScript version type checking (excluding core `@zimic/*` packages during TS matrix except for build impact
  detection). Do not rely on implicit deps—declare them; missing dependency errors will surface in selective matrix
  runs.
- To adjust typegen behavior, modify the example script then update the CI diff step accordingly.

## Adding Features Safely

When implementing changes:

1. Pick target package; add tests first (cover Node + browser + local/remote if relevant). Reuse shared test
   declarations if applicable.
2. Implement clean and readable code with clear purpose. Avoid over-engineering and unnecessary abstractions; prefer
   composition over inheritance; avoid premature optimization; try to not use `any`; use type inference where possible;
   abstract only when it improves clarity or reduces duplication (e.g. by moving a general utility to `src/utils/...`).
3. Implement minimal API surface; export intentionally (update `exports`).
4. Maintain 100% coverage (add tests for new branches, error paths, and edge cases).
5. Run locally:
   - `pnpm turbo types:check --filter <project>`
   - `pnpm turbo test:turbo --filter <project>`
   - `pnpm turbo build --filter <project>`
6. Update docs (`apps/zimic-web/docs`) after API changes, adding short code snippets and updating existing examples;
   highlight experimental or unstable features as such; ensure Docusaurus build passes; ensure clear and concise
   language and examples.
7. Update examples (`examples/*`) to reflect new features or changes when needed, ensuring they remain functional and
   type-safe.

## Common Pitfalls

- Forgetting to add or update tests, especially for edge cases, error paths, new features, and bug fixes.
- Forgetting to update documentation or examples after API changes.
- Forgetting to run tests and type checks.
- Introducing unwanted breaking changes to public APIs without version bump.
- Adding third-party dependencies without considering bundle size impact, checking license compatibility, or
  redundantly, either already available natively or present in another package.
- Introducing side-effectful top-level code breaks tree-shaking and `sideEffects: false` guarantee.
- Exporting test utilities accidentally (keep them under `__tests__` or `tests` only).
- Skipping updates to `exports` map leading to unresolved imports for consumers.

## Style and Commits

- Conventional commits with lowercase imperative, scoped to package (e.g., `feat(interceptor): add request caching`).
  Use `root` scope for repository-wide changes. Refer to `.commitlintrc.json` to check all scopes and rules. Keep branch
  names aligned (e.g., `feat/123-request-caching`).

---

Feedback welcome: Identify any missing architectural nuance, unclear workflow, or additional conventions you want
documented.
