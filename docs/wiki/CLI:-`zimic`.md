## Contents <!-- omit from toc -->

- [`zimic`](#zimic)

---

The CLI module `zimic` contains root-level commands.

- [`zimic browser`](CLI:-`zimic-browser`)
- [`zimic server`](CLI:-`zimic-server`)
- [`zimic typegen`](CLI:-`zimic-typegen`)

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
