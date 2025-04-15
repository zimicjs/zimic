<h1>
  @zimic/interceptor + Vitest + JSDOM
</h1>

This example uses [@zimic/interceptor](https://www.npmjs.com/package/@zimic/interceptor) with
[Vitest](https://vitest.dev), [JSDOM](https://github.com/jsdom/jsdom), and
[Testing Library](https://testing-library.com).

- [Application](#application)
- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Test](#test)
- [Running](#running)

## Application

The application is a simple HTML layout rendered by vanilla JavaScript, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app.ts`](./src/app.ts)

## Testing

An example test suite uses Vitest to test the application. `@zimic/interceptor` is used to mock the GitHub API and
simulate a test case where the repository is found and another where it is not.

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
