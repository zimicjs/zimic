<h1>
  Zimic + OpenAPI typegen
</h1>

This example uses Zimic and the `zimic-http typegen` CLI to generate types from the GitHub API.
[Node.js](https://nodejs.org) and [Vitest](https://vitest.dev) are used in this example, but other frameworks and
runtimes should be similar, such as [Deno](https://deno.com), [Bun](https://bun.sh), and [Jest](https://jestjs.io).

- [Application](#application)
- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Configuration](#configuration)
- [Try it](#try-it)
  - [CodeSandbox](#codesandbox)
  - [StackBlitz](#stackblitz)
  - [Cloning locally](#cloning-locally)
- [Running](#running)

## Application

`@zimic/fetch` is used to make requests to the [GitHub API](https://docs.github.com/rest), whose types are generated
automatically from
[their official OpenAPI documentation](https://github.com/github/rest-api-description/tree/main/descriptions-next/api.github.com).
A `typegen:github` script is declared in [`package.json`](./package.json) and can be used as follows:

```bash
pnpm typegen:github
```

- Generated types: [`src/types/github/typegen/generated.ts`](./src/types/github/typegen/generated.ts)
- Typegen filters: [`src/types/github/typegen/filters.txt`](./src/types/github/typegen/filters.txt)

> [!TIP]
>
> Typegen filters are useful to select only a subset of the available endpoints. The GitHub's API is large and we only
> need to generate the types used by this project.
>
> Learn more: https://zimic.dev/docs/http/cli/typegen#openapi-filtering

`@zimic/fetch` is used to make requests to the [GitHub API](https://docs.github.com/rest), whose responses are mocked
with `@zimic/interceptor`.

> [!TIP]
>
> `@zimic/fetch` and `@zimic/interceptor` are not required to be used together. `@zimic/interceptor` is compatible with
> any HTTP client implementation, as `@zimic/fetch` works with any HTTP interceptor library. With that in mind,
> `@zimic/fetch` and `@zimic/interceptor` work best together, providing a seamless and type-safe experience for
> performing HTTP requests in your application and mocking them during development and testing.

## Testing

This project uses Vitest to test the application.

### `@zimic/interceptor`

- Zimic interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Configuration

- Example test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

## Try it

### StackBlitz

<a href="https://stackblitz.com/github/zimicjs/zimic/tree/main/examples/zimic-with-openapi-typegen?file=README.md">
  <img
    src="https://developer.stackblitz.com/img/open_in_stackblitz.svg"
    alt="Open in StackBlitz"
    height="36px"
  />
</a>

### CodeSandbox

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/zimic-with-openapi-typegen">
  <img
    src="https://codesandbox.io/static/img/play-codesandbox.svg"
    alt="Edit in CodeSandbox"
    height="36px"
  />
</a>

### Cloning locally

```bash
mkdir zimic-tmp
cd zimic-tmp
git init
git remote add origin git@github.com:zimicjs/zimic.git
git sparse-checkout init
git sparse-checkout set examples/zimic-with-openapi-typegen
git pull origin main # or a specific branch or tag
mv examples/zimic-with-openapi-typegen ..
cd ../zimic-with-openapi-typegen
rm -rf ../zimic-tmp
```

> [!TIP]
>
> If you'd like to clone the example of a specific version, replace `main` with the desired branch or tag, such as
> `@zimic/interceptor@0` and `@zimic/fetch@0.1.0`.

## Running

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Run the tests:

   ```bash
   pnpm run test
   ```
