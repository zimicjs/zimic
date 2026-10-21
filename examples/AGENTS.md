# Zimic examples

Each `zimic-with-*` directory is a standalone project that users clone with a sparse checkout or open in StackBlitz and CodeSandbox (`sandbox.config.json`).

- Depend on published `@zimic/*` versions, not `workspace:` ranges, and import only from public entry points. Never import internal packages such as `@zimic/utils`.
- Keep each example runnable with only the steps in its `README.md`: install, the `setup` script when the example defines one, and the `test` script.
- Follow the `README.md` structure of the sibling examples. When adding, removing, or renaming an example, update `examples/README.md` and the examples page of the website docs.
- Update affected examples when a public API they use changes.
- `zimic-with-openapi-typegen` commits generated types that CI compares against the live GitHub OpenAPI spec. Regenerate them with its `typegen:github` script instead of editing them by hand.
- Lint and style scripts run from `examples`. Type check and test scripts run from each example directory.
