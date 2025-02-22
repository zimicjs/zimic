# CLI: `zimic`

```
zimic [command]

Commands:
  zimic-interceptor browser  Manage your browser mock configuration
  zimic-interceptor server   Manage interceptor servers
  zimic-http typegen  Generate types from schema sources

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
```

See also:

- [`zimic-interceptor browser`](cli‐zimic‐browser)
- [`zimic-interceptor server`](cli‐zimic‐server)
- [`zimic-http typegen`](cli‐zimic‐typegen)

> [!TIP]
>
> All boolean options in Zimic's CLI can be prefixed with `--no-` to negate them.
>
> For example, all of the options below are equivalent and indicate that comments are **disabled**:
>
> ```bash
> --no-comments
> --comments false
> --comments=false
> ```
>
> On the other hand, all of the options below are also equivalent and indicate that comments are **enabled**:
>
> ```bash
> --comments
> --comments true
> --comments=true
> ```
