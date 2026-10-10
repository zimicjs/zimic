# Test client

Follow the root [AGENTS.md](../../AGENTS.md) for general rules. This app is a package consumer used to verify public exports. For each public package entry point, add or update consumer coverage here and keep its imports representative of supported usage. Pair these consumer checks with package tests and export-map changes. Do not require public compatibility or export coverage for internal `@zimic/utils`.
