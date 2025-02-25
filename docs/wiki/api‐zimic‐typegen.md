# API reference: `@zimic/http/typegen` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`typegen.generateFromOpenAPI(options)`](#typegengeneratefromopenapioptions)
- [CLI usage](#cli-usage)

---

`@zimic/http/typegen` exports resources to generate types programmatically. We recommend using the
[`zimic-http typegen` CLI](cli‐zimic‐typegen), but this is still a valid alternative for more advanced use cases.

## `typegen.generateFromOpenAPI(options)`

An example using the programmatic API to generate types from an OpenAPI schema:

```ts
import { typegen } from '@zimic/http/typegen';

await typegen.generateFromOpenAPI({
  input: './schema.yaml',
  output: './schema.ts',
  serviceName: 'MyService',
  filters: ['* /users**'],
  includeComments: true,
  prune: true,
});
```

The options of `typegen.generateFromOpenAPI(options)` are the same as the CLI options for the
`zimic-http typegen openapi` command.

## CLI usage

See the [`zimic-http typegen` CLI reference](cli‐zimic‐typegen).
