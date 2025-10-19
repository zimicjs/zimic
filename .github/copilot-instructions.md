# AI Agent Instructions

These instructions focus on project-specific architecture, workflows, and conventions so that an AI agent can make
correct, minimal, high-quality changes and review proposed modifications effectively.

## Overview

- Monorepo (pnpm + turborepo) providing TypeScript-first HTTP integration libraries: `@zimic/http`, `@zimic/fetch`,
  `@zimic/interceptor`, plus internal `@zimic/utils` and supporting configuration packages.
- Documentation: `apps/zimic-web` (Docusaurus).
- Test consumer app: `apps/zimic-test-client`.
- Example projects: `examples/*`.
- Core flow: define HTTP schemas (`@zimic/http`) -> consume via type-safe client (`@zimic/fetch`) -> mock/intercept real
  network calls locally or remotely (`@zimic/interceptor`).
- All public packages target Node >=20 and modern browsers;
- Builds via `tsup` generate dual ESM/CJS outputs with explicit export maps and top-level `.d.ts` entry points.

## Project Structure

- `packages`
  - `zimic-http`: Implementation of the package `@zimic/http`, a collection of type-safe utilities to handle HTTP
    requests and responses, including headers, search params, and form data;
  - `zimic-fetch`: Implementation of the package `@zimic/fetch`, a minimal (~2 kB minified gzipped) and type-safe
    `fetch`-like API client;
  - `zimic-interceptor`: Implementation of the package `@zimic/interceptor`, a type-safe interceptor library for
    handling and mocking HTTP requests in development and testing;
  - `zimic-utils`: Shared primitives (data comparison, URL building, wait utilities, logging, type helpers); each
    exported resource is exported as a single file to keep bundles small and help clients import only what they need;
  - `tsconfig`: Shared TypeScript configuration;
  - `eslint-config`: General ESLint configuration;
  - `eslint-config-node`: Node.js-specific ESLint configuration;
  - `lint-staged-config`: Configuration for [lint-staged](https://github.com/lint-staged/lint-staged);
- `apps`
  - `zimic-web`: [zimic.dev](https://zimic.dev) documentation website built with [Docusaurus](https://docusaurus.io) and
    styled with Tailwind CSS;
  - `zimic-test-client`: Test application to check Zimic installed as a dependency; important to verify the library
    exports and build artifacts;
- `examples`: Example projects using Zimic;

## Build and Task Workflow

- Root scripts wrap turborepo tasks:
  - `pnpm build` -> `turbo build`;
  - `pnpm test` -> `turbo test:turbo`;
  - `pnpm lint` -> `turbo lint:turbo`;
  - `pnpm types:check` -> `turbo types:check`;
- Task graph (`turbo.json`): `dev` depends on parent `build` (no caching for watch); tests and type checks depend on
  builds of their dependencies; linting depends on type checks to avoid false positives.
- Package-level scripts often pair `test` (interactive) with `test:turbo` (CI + coverage). Coverage required to remain
  100% for core packages; never lower thresholds; add or adjust tests instead.
- Avoid editing generated declaration files (`index.d.ts`, `http.d.ts`, etc.), except the top-level entry points; ;
  change source and rebuild.

## Testing Conventions

- Runner: Vitest (Node + `@vitest/browser` + Playwright); browser tests need chromium via per-package `deps:setup` /
  `deps:setup-playwright` scripts;
- File layout: source-near `__tests__` directories; test filenames: `<resource>.test.ts`; test suites dedicated to
  specific features or environments can have a prefix (e.g., `<resource>.<feature>.test.ts`);
- Avoid mocking internals; prefer exercising the public APIs;
- Only use spies when asserting side effects;
- Keep test code close to tested module;
- Ensure test utilities are not exported in production bundles;

## Path and Build Constraints

- TypeScript config: `moduleResolution: bundler`, strict mode, incremental builds;
- Do not introduce features requiring different module resolution without updating shared tsconfig;
- Exports are explicit; adding a new public resource requires updating the entry point where it will be exported;
- Keep tree-shakability: avoid side effects (respect `sideEffects: false`);

## Interceptor Architecture Notes

- Most resources should be compatible with both Node.js and browser environments; ensure new behavior considers both
  environments and both platforms (Node.js vs browser);
- Local and remove interceptors have different implementations, but share similar public APIs and behavior; ensure that
  tests are written in a way that is compatible with both implementations; also ensure that tests verify both
  implementations with little to no distinction;
- Remote mode may spin up an interceptor server; test helpers manage lifecycle (`createInternalInterceptorServer`,
  `startServer/stopServer` callbacks).

## CLI Conventions

- Each package exposing a CLI uses `tsup` to build `dist/*.js` (with source maps) and declares a `bin` entry;
- Add new CLI commands inside the respective package; wire them through `yargs` with consistent option naming
  (kebab-case);
- Keep Node compatibility with declared engine;

## Adding Features Safely

When implementing changes:

- Pick target package; add tests first (cover Node + browser + local/remote if relevant). Reuse shared test declarations
  and/or existing structure and utilities if applicable;
- Implement clean and readable code with clear purpose;
- Avoid abbreviations and unclear names; prefer explicit and descriptive naming, even if longer;
- Avoid over-engineering and unnecessary abstractions;
- Prefer composition over inheritance;
- Avoid premature optimization;
- Try to not use `any`;
- Use type inference where possible; abstract only when it improves clarity or reduces duplication (e.g. by moving a
  general utility to `src/utils/...`);
- Implement minimal API surface; export intentionally (update `exports`);
- Maintain 100% coverage (add tests for new branches, error paths, and edge cases);
- Run locally (inside target app or package):
  - `pnpm types:check`
  - `pnpm lint .`
  - `pnpm test`
  - `pnpm build`
- Update documentation (`apps/zimic-web/docs`) after API changes, adding short code snippets and updating existing
  examples; highlight experimental or unstable features as such; ensure Docusaurus build passes; ensure clear and
  concise language and examples;
- Update examples (`examples/*`) to reflect new features or changes when needed, ensuring they remain functional and
  type-safe;

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
- Pull requests: use the same conventional style in titles; provide clear descriptions of changes, linking to relevant
  issues or discussions; ensure all checks pass before requesting reviews.

## CI Expectations

- CI enforces:
  - Formatting style;
  - Lint;
  - Types;
  - Documentation build;
  - Multi-Node version tests;
  - Multi-TypeScript version type checking (excluding core `@zimic/*` packages during TypeScript matrix except for build
    impact detection);
- Do not rely on implicit dependencies; declare them;

---

Feedback welcome: Identify any missing architectural nuance, unclear workflow, or additional conventions you want
documented.
