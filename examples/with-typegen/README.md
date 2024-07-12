<h1>
  Zimic + Typegen
</h2>

This example uses Zimic with `zimic typegen`. [Node.js](https://nodejs.org) and [Vitest](https://vitest.dev) are used in
this example, but other frameworks and runtimes should be similar, such as [Deno](https://deno.com),
[Bun](https://bun.sh), and [Jest](https://jestjs.io).

## Application

The application is a simple [Fastify](https://fastify.dev) server, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest). Any other Node.js framework could be used as well, such as
[express](https://expressjs.com) and [Nest.js](https://nestjs.com).

- Server: [`src/app.ts`](./src/app.ts)

The types for the GitHub API are generated automatically using the `zimic typegen` CLI, based on
[their official spec](https://github.com/github/rest-api-description/tree/main/descriptions-next/api.github.com). A
`typegen:github` script is declared in [`package.json`](./package.json) and can be used as follows:

```bash
pnpm typegen:github
```

- Generated types: [`src/types/github/typegen/generated.ts`](./src/types/github/typegen/generated.ts)
- Typegen filters: [`src/types/github/typegen/filters.txt`](./src/types/github/typegen/filters.txt)

> [!TIP]
>
> Typegen filters are useful to select only a subset of the available endpoints. The GitHub's API is large and we only
> need to generate the types used by this project.

Learn more: https://github.com/zimicjs/zimic#zimic-typegen

## Testing

An example test suite uses Vitest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

### Zimic

- Zimic interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

### Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:zimicjs/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-typegen
   git pull origin main
   cd examples/with-typegen
   ```

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Run the tests:

   ```bash
   pnpm run test
   ```
