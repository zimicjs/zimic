<h1>
  Zimic + Vitest + JSDOM
</h1>

This example uses Zimic with [Vitest](https://vitest.dev), and [JSDOM](https://github.com/jsdom/jsdom).

- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Configuration](#configuration)
- [Try it](#try-it)
  - [StackBlitz](#stackblitz)
  - [CodeSandbox](#codesandbox)
  - [Cloning locally](#cloning-locally)
- [Running](#running)

## Testing

`@zimic/fetch` is used to make requests to the [GitHub API](https://docs.github.com/rest), whose responses are mocked
with `@zimic/interceptor`.

> [!TIP]
>
> `@zimic/fetch` and `@zimic/interceptor` are not required to be used together. `@zimic/interceptor` is compatible with
> any HTTP client implementation, as `@zimic/fetch` works with any HTTP interceptor library. With that in mind,
> `@zimic/fetch` and `@zimic/interceptor` work best together, providing a seamless and type-safe experience for
> performing HTTP requests in your application and mocking them during development and testing.

### `@zimic/interceptor`

- GitHub HTTP interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Configuration

- Example test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

## Try it

### StackBlitz

<a href="https://stackblitz.com/github/zimicjs/zimic/tree/main/examples/zimic-with-vitest-jsdom?file=README.md">
  <img
    src="https://developer.stackblitz.com/img/open_in_stackblitz.svg"
    alt="Open in StackBlitz"
    height="36px"
  />
</a>

### CodeSandbox

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/zimic-with-vitest-jsdom">
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
git sparse-checkout set examples/zimic-with-vitest-jsdom
git pull origin main # or a specific branch or tag
mv examples/zimic-with-vitest-jsdom ..
cd ../zimic-with-vitest-jsdom
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
