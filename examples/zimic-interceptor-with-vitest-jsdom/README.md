<h1>
  @zimic/interceptor + Vitest + JSDOM
</h1>

This example uses [@zimic/interceptor](https://www.npmjs.com/package/@zimic/interceptor) with
[Vitest](https://vitest.dev), and [JSDOM](https://github.com/jsdom/jsdom).

- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Test](#test)
- [Running](#running)

## Testing

`@zimic/interceptor` is used to mock requests made to the [GitHub API](https://docs.github.com/rest).

### `@zimic/interceptor`

- GitHub HTTP interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

## Running

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/with-vitest-jsdom">
  <img
    src="https://codesandbox.io/static/img/play-codesandbox.svg"
    alt="Edit in CodeSandbox"
    height="36px"
  />
</a>

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Run the tests:
   ```bash
   pnpm run test
   ```
