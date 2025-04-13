<h1>
  Zimic + Next.js App Router
</h2>

This example uses Zimic with [Next.js](https://nextjs.org).

## Application

The application is a simple [Next.js](https://nextjs.org) project using the [App Router](https://nextjs.org/docs/app).
It fetches repositories from the [GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app/page.tsx`](./src/app/page.tsx)
- GitHub fetch: [`src/services/github.ts`](./src/services/github.ts)

A `postinstall` script in [`package.json`](./package.json) is used to install Playwright's browsers.

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. Zimic is used to mock the
GitHub API and simulate a test case where the repository is found and another where it is not.

### Zimic

- GitHub interceptor and mocks: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

#### Loading mocks

The script [`tests/interceptors/scripts/load.ts`](./tests/interceptors/scripts/load.ts) loads the interceptors and mocks
before the application is started in development. It is used by the command `dev:mock` in
[`package.json`](./package.json).

### Test

- Test suite: [`src/__tests__/HomePage.e2e.test.ts`](./src/__tests__/HomePage.e2e.test.ts)
- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

## Running

### Running in CodeSandbox

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/with-next-js-app">
  <img
    src="https://codesandbox.io/static/img/play-codesandbox.svg"
    alt="Edit in CodeSandbox"
    height="36px"
  />
</a>

After opening in CodeSandbox, click "Fork" on the top right to create your own copy of the example. The terminal should
open automatically once your fork is ready.

![CodeSandbox Fork](../docs/images/codesandbox-fork.png)

### Running locally

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Run the tests:

   1. Start the application:

      ```bash
      pnpm run dev:mock
      ```

      After started, the application will be available at [http://localhost:3006](http://localhost:3006).

   2. In another terminal, run the tests:

      ```bash
      pnpm run test --ui
      ```
