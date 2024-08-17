# Contents <!-- omit from toc -->

- [`zimic`](#zimic)

---

# `zimic`

This CLI module contains root-level commands.

- [`zimic browser`](cli-zimic-browser)
- [`zimic server`](cli-zimic-server)
- [`zimic typegen`](cli-zimic-typegen)

```
zimic [command]

Commands:
  zimic browser  Manage your browser mock configuration
  zimic server   Manage interceptor servers
  zimic typegen  Generate types from schema sources

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
```

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
