# API reference: `zimic/typegen` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`typegen.generateFromOpenAPI(options)`](#typegengeneratefromopenapioptions)
- [CLI usage](#cli-usage)

---

This module exports resources to generate types programmatically. We recommend using the
[`zimic typegen` CLI](cli‐zimic‐typegen), but this is still a valid alternative for more advanced use cases.

## `typegen.generateFromOpenAPI(options)`

An example using the programmatic API to generate types from an OpenAPI schema:

```ts
import { typegen } from 'zimic/typegen';

await typegen.generateFromOpenAPI({
  input: './schema.yaml',
  output: './schema.ts',
  serviceName: 'MyService',
  filters: ['* /users**'],
  includeComments: true,
  prune: true,
});
```

The options of `typegen.generateFromOpenAPI(options)` are the same as the CLI options for the `zimic typegen openapi`
command.

## CLI usage

See the [`zimic typegen` CLI reference](cli‐zimic‐typegen).
