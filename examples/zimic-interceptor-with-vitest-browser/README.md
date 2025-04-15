<h1>
  @zimic/interceptor + Vitest + Browser Mode
</h1>

This example uses [@zimic/interceptor](https://www.npmjs.com/package/@zimic/interceptor) with
[Vitest](https://vitest.dev) with [Browser Mode](https://vitest.dev/guide/browser) enabled. It uses
[Playwright](https://playwright.dev) as the browser provider for Vitest.

- [Application](#application)
- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Test](#test)
- [Running](#running)

## Application

A `postinstall` script in [`package.json`](./package.json) is used to install Playwright's browsers and initialize
Zimic's mock service worker to the `./public` directory. The mock service worker at `./public/mockServiceWorker.js` is
ignored in the [`.gitignore`](./.gitignore) file.

## Testing

`@zimic/interceptor` is used to mock requests made to the [GitHub API](https://docs.github.com/rest).

### `@zimic/interceptor`

- GitHub HTTP interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

## Running

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/with-vitest-browser">
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
