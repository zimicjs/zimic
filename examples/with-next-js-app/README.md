<h1>
  Zimic + Next.js
</h2>

This example uses Zimic with [Next.js](https://nextjs.org). The application is verified with end-to-end tests using
[Playwright](https://playwright.dev).

## Application

The application is a simple [Next.js](https://nextjs.org) application, using both the
[App Router](https://nextjs.org/docs/app) and the [Pages Router](https://nextjs.org/docs/pages). It fetches repositories
from the [GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app/app/page.page.tsx`](./src/app/page.tsx)
- Interceptor provider:
  [`src/providers/interceptors/InterceptorProvider.tsx`](./src/providers/interceptors/InterceptorProvider.tsx)
  - This provider is used to apply Zimic mocks when the application is started in development.
- GitHub fetch: [`src/services/github.ts`](./src/services/github.ts)
  - Before fetching resources, it is necessary to wait for the interceptors and fixtures to be loaded. This is done via
    `await waitForLoadedInterceptors();`.

A `postinstall` in [`package.json`](./package.json#L11) script is used to install Playwright's browsers.

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. Zimic is used to mock the
GitHub API and simulate a test case where the repository is found and another where it is not.

### Zimic

- GitHub interceptor: [`tests/interceptors/github/interceptor.ts`](./tests/interceptors/github/interceptor.ts)
  - Fixtures: [`tests/interceptors/github/fixtures.ts`](./tests/interceptors/github/fixtures.ts)

### Test

- Test suite: [`src/__tests__/HomePage.e2e.test.ts`](./src/__tests__/HomePage.e2e.test.ts)
- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

### Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:diego-aquino/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-next-js
   git pull origin main
   cd examples/with-next-js
   ```

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Run the tests:

   1. Start the application:

      ```bash
      pnpm run dev
      ```

      After started, the application will be available at [http://localhost:3004](http://localhost:3004).

   2. In another terminal, run the tests:

      ```bash
      pnpm run test --ui
      ```
