---
title: Typegen | @zimic/http
sidebar_label: Typegen
slug: /http/api/typegen
---

# Typegen

`@zimic/http/typegen` exports resources to generate types programmatically. We recommend using the
[`zimic-http typegen` CLI](/docs/zimic-http/cli/1-typegen.md), but this is still a valid alternative for more advanced
use cases.

**Related**:

- [Guides - Typegen](/docs/zimic-http/guides/2-typegen.mdx)
- [CLI usage](/docs/zimic-http/cli/1-typegen.md)

## `generateTypesFromOpenAPI()`

Generate types from an [OpenAPI](https://swagger.io/specification) schema.

```ts
await generateTypesFromOpenAPI(options);
```

**Arguments**:

1. **options**: `OpenAPITypegenOptions`

   1. **input**: `string`

      The path to a local OpenAPI schema file or an URL to fetch it. Version 3 is supported as YAML or JSON.

   2. **output**: `string | undefined`

      The path to write the generated types to. If not provided, the types will be written to stdout.

   3. **serviceName**: `string`

      The name of the service to use in the generated types.

   4. **includeComments**: `boolean | undefined` (default: `true`)

      Whether to include comments in the generated types.

   5. **prune**: `boolean | undefined` (default: `true`)

      Whether to remove unused operations and components from the generated types. This is useful for reducing the size
      of the output file.

   6. **filters**: `string[] | undefined`

      One or more expressions to filter the types to generate. Filters must follow the format `<method> <path>`, where
      `<method>` is an HTTP method or `*`, and `<path>` is a literal path or a glob. Filters are case-sensitive
      regarding paths. For example, `GET /users`, `* /users`, `GET /users/*`, and `GET /users/**/*` are valid filters.
      Negative filters can be created by prefixing the expression with `!`. For example, `!GET /users` will exclude
      paths matching `GET /users`. If more than one positive filter is provided, they will be combined with OR, while
      negative filters will be combined with AND.

   7. **filterFile**: `string | undefined`

      A path to a file containing filter expressions. One expression is expected per line and the format is the same as
      used in a `--filter` option. Comments are prefixed with `#`. A filter file can be used alongside additional
      `--filter` expressions.

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
