# AI Agent Instructions

Guidelines for implementing changes that align with project architecture, conventions, and quality standards.

## Project Overview

TypeScript monorepo (pnpm + turborepo) providing HTTP integration libraries:

- **Core packages**: `@zimic/http` (HTTP schemas), `@zimic/fetch` (type-safe client), `@zimic/interceptor` (request
  mocking), `@zimic/utils` (shared utilities)
- **Configuration**: `tsconfig`, `eslint-config`, `eslint-config-node`, `lint-staged-config`
- **Documentation**: `apps/zimic-web` (Docusaurus + Tailwind CSS)
- **Testing**: `apps/zimic-test-client` (verifies exports and build artifacts)
- **Examples**: `examples/*` (integration demonstrations)

**Targets**: Node >=20, modern browsers; dual ESM/CJS via `tsup` with explicit `exports` maps.

## Key Architecture Constraints

- **Module resolution**: `moduleResolution: bundler`, strict mode, incremental builds
- **Exports**: Explicit `exports` map required for all public APIs; update when adding resources
- **Tree-shaking**: `sideEffects: false` must be respected; avoid top-level side effects
- **Cross-platform**: Most code must work in Node.js and browser environments
- **Interceptor duality**: Local and remote interceptors share APIs but differ in implementation; tests must verify both
- **Bundle size**: Each `@zimic/utils` export is a separate file to minimize client bundles

## Development Workflow

### Before Changes

1. Identify target package
2. Review existing tests and structure for patterns to reuse
3. Check if cross-platform (Node + browser) or dual-mode (local + remote) support needed

### During Implementation

1. **Write tests first** covering all branches, error paths, and edge cases
2. Implement feature with clear, explicit naming (avoid abbreviations)
3. Keep code simple; avoid premature optimization and unnecessary abstractions
4. Never use `any`; leverage type inference
5. Update `exports` map if adding new public API
6. Update documentation (`apps/zimic-web/docs`) with examples
7. Update relevant examples (`examples/*`) if needed

### Verification

Run in the target package directory:

- `pnpm types:check`: Type check with `tsc`
- `pnpm lint <pattern>`: Lint specific files or directories using `eslint`
- `pnpm test run <pattern>`: Run specific tests using `vitest`
- `pnpm build`: Build package with `tsup`

### Critical Rules

- **Coverage**: Maintain 100% for core packages; never lower thresholds
- **Declarations**: Don't edit generated `.d.ts` files except top-level entry points
- **Dependencies**: Avoid adding unless essential; prefer native modules; check bundle size and license
- **Breaking changes**: Require version bump

## Testing Standards

**Runner**: Vitest with Node + `@vitest/browser` (Playwright/Chromium)

**Structure**:

- Location: `__tests__/` directories near source
- Naming: `<resource>.test.ts` or `<resource>.<feature>.test.ts`
- Test utilities: Keep in `__tests__/` or `tests/` only (never export in production)

**Principles**:

- Test public APIs, not internals
- Avoid mocking; exercise real behavior
- Use spies only for side-effect assertions
- Ensure 100% coverage including edge cases and error paths
- Support both Node + browser, local + remote where applicable

## Code Quality Standards

- **Naming**: Explicit and descriptive (prefer clarity over brevity)
- **Architecture**: Composition over inheritance; minimal API surface
- **Type Safety**: Strict TypeScript; avoid `any`; use inference
- **Optimization**: Only when measured; avoid premature optimization
- **CLI** (if applicable): Build to `dist/*.js` via `tsup`; use `yargs` with kebab-case options

## Common Mistakes to Avoid

- Missing tests for edge cases, error paths, or new features
- Forgetting to update documentation or examples after API changes
- Skipping local verification (types, lint, tests, build)
- Breaking public APIs without version bump
- Adding unnecessary dependencies (check bundle size, license, redundancy)
- Introducing side effects that break tree-shaking
- Exporting test utilities in production bundles
- Missing `exports` map updates for new public APIs

## Commit Conventions

- **Format**: Conventional commits, lowercase imperative, scoped to package
- **Examples**: `feat(interceptor): add request caching`, `fix(http): handle empty headers`
- **Scope**: Use `root` for repository-wide changes; see `.commitlintrc.json` for all scopes
- **Branches**: Align with commit type (e.g., `feat/123-request-caching`)
- **PRs**: Follow same conventions; link issues; ensure all CI checks pass
