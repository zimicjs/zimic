---
title: zimic-http typegen | @zimic/http
sidebar_label: zimic-http typegen
slug: /http/cli/typegen
---

# `zimic-http typegen`

`zimic-http typegen` contains commands to generate types from schema sources. This is useful to save development time,
avoid errors and keep your types consistent with specifications, such as [OpenAPI](https://swagger.io/specification).

```
zimic-http typegen

Generate types from schema sources.

Commands:
  zimic-http typegen openapi <input>  Generate types from an OpenAPI schema.
```

**Related**:

- [Guides - Typegen](/docs/zimic-http/guides/2-typegen.mdx)
- [API - `@zimic/http/typegen`](/docs/zimic-http/api/5-typegen.md)

## `zimic-http typegen openapi`

Generate types from an [OpenAPI](https://swagger.io/specification) schema.

```
zimic-http typegen openapi <input>

Positionals:
  input  The path to a local OpenAPI schema file or an URL to fetch it. Version
         3 is supported as YAML or JSON.                     [string] [required]

Options:
  -o, --output        The path to write the generated types to. If not provided,
                      the types will be written to stdout.              [string]
  -s, --service-name  The name of the service to use in the generated types.
                                                             [string] [required]
  -c, --comments      Whether to include comments in the generated types.
                                                       [boolean] [default: true]
  -p, --prune         Whether to remove unused operations and components from
                      the generated types. This is useful for reducing the size
                      of the output file.              [boolean] [default: true]
  -f, --filter        One or more expressions to filter the types to generate.
                      Filters must follow the format `<method> <path>`, where
                      `<method>` is an HTTP method or `*`, and `<path>` is a
                      literal path or a glob. Filters are case-sensitive
                      regarding paths. For example, `GET /users`, `* /users`,
                      `GET /users/*`, and `GET /users/**/*` are valid filters.
                      Negative filters can be created by prefixing the
                      expression with `!`. For example, `!GET /users` will
                      exclude paths matching `GET /users`. If more than one
                      positive filter is provided, they will be combined with
                      OR, while negative filters will be combined with AND.
                                                                         [array]
  -F, --filter-file   A path to a file containing filter expressions. One
                      expression is expected per line and the format is the same
                      as used in a `--filter` option. Comments are prefixed with
                      `#`. A filter file can be used alongside additional
                      `--filter` expressions.                           [string]
```

You can use this command to generate types from a local OpenAPI file:

```bash
zimic-http typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService
```

Or an URL to fetch it:

```bash
zimic-http typegen openapi https://example.com/api/openapi.yaml \
  --output ./schema.ts \
  --service-name MyService
```

Our [OpenAPI typegen example](https://github.com/zimicjs/zimic/tree/main/examples/zimic-with-openapi-typegen#readme)
demonstrates how to use `zimic-http typegen openapi` to generate types and use them in your application and
interceptors.

### OpenAPI comments

By default, descriptions in the OpenAPI schema are included as comments in the generated types. You can omit them using
`--no-comments` or `--comments false`.

```bash
zimic-http typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --no-comments
```

### OpenAPI pruning

By default, pruning is enabled, meaning that unused types are not generated. If you want all types declared in the
schema to be generated, use `--no-prune` or `--prune false`.

```bash
zimic-http typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --no-prune
```

### OpenAPI filtering

You can also filter a subset of paths to generate types for. Combined with [pruning](#openapi-pruning), this is useful
to reduce the size of the output file and only generate the types you need.

```bash
zimic-http typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --filter 'GET /users**'
```

When many filters are used, a filter file can be provided, where each line represents a filter expression and comments
are marked with `#`:

```txt title='filters.txt'
# Include any endpoint starting with /users and having any HTTP method
* /users**

# Include any sub-endpoints of /posts with method GET.
GET /posts/**/*

# Include the endpoints /workspaces with methods GET, POST, or PUT.
GET,POST,PUT /workspaces

# Exclude endpoints to get user notifications
!GET /users/*/notifications/**/*
```

Then, use the filter file in the command:

```bash
zimic-http typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --filter-file ./filters.txt
```
