# Contents <!-- omit from toc -->

- [`zimic/typegen`](#zimictypegen)
- [CLI usage](#cli-usage)

---

## `zimic/typegen`

This module exports resources for generating types programmatically. We recommend using the CLI, but this is still a
valid alternative for more advanced use cases.

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

The parameters of `typegen.generateFromOpenAPI` are the same as the CLI options for the `zimic typegen openapi` command.

## CLI usage

See the [`zimic typegen` CLI reference](cli-zimic-typegen).
