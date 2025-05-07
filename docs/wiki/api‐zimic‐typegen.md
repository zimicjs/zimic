> [!TIP]
>
> Zimic's documentation is now available on [zimic.dev](https://zimic.dev)! :tada:
>
> Check it out for the latest updates, guides, and documentation.

# `@zimic/http/typegen` - API reference <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`generateTypesFromOpenAPI(options)`](#generatetypesfromopenapioptions)
- [CLI usage](#cli-usage)

---

`@zimic/http/typegen` exports resources to generate types programmatically. We recommend using the
[`zimic-http typegen` CLI](cli‐zimic‐typegen), but this is still a valid alternative for more advanced use cases.

## `generateTypesFromOpenAPI(options)`

An example using the programmatic API to generate types from an OpenAPI schema:

```ts
import { generateTypesFromOpenAPI } from '@zimic/http/typegen';

await generateTypesFromOpenAPI({
  input: './schema.yaml',
  output: './schema.ts',
  serviceName: 'MyService',
  filters: ['* /users**'],
  includeComments: true,
  prune: true,
});
```

The options of `generateTypesFromOpenAPI(options)` are the same as the CLI options for the `zimic-http typegen openapi`
command.

## CLI usage

See the [`zimic-http typegen` CLI reference](cli‐zimic‐typegen).
