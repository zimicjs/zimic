<h1>
  Zimic + Next.js Pages Router
</h2>

This example uses Zimic with [Next.js](https://nextjs.org).

## Application

The application is a simple [Next.js](https://nextjs.org) project using the
[Pages Router](https://nextjs.org/docs/pages). It fetches repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/pages/index.page.tsx`](./src/pages/index.page.tsx)
- GitHub fetch: [`src/services/github.ts`](./src/services/github.ts)

The file [`_app.page.tsx`](./src/pages/_app.page.tsx) loads the interceptors and mocks before the rest of the
application is rendered in development.

A `postinstall` script in [`package.json`](./package.json) is used to install Playwright's browsers and initialize
Zimic's mock service worker to the `./public` directory. The mock service worker at `./public/mockServiceWorker.js` is
ignored in the [`.gitignore`](./.gitignore) file.

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. Zimic is used to mock the
GitHub API and simulate a test case where the repository is found and another where it is not.

### Zimic

- GitHub interceptor and mocks: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`src/__tests__/HomePage.e2e.test.ts`](./src/__tests__/HomePage.e2e.test.ts)
- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

## Running

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/with-next-js-pages">
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

   1. Start the application:

      ```bash
      pnpm run dev
      ```

      After started, the application will be available at [http://localhost:3008](http://localhost:3008).

   2. In another terminal, run the tests:

      ```bash
      pnpm run test --ui
      ```
