<h1>
  Zimic + Playwright
</h2>

This example uses Zimic with [Playwright](https://playwright.dev) in end-to-end tests.

## Application

The tested application is a simple [Next.js](https://nextjs.org) project, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app/page.tsx`](./src/app/page.tsx)
- GitHub fetch: [`src/services/github.ts`](./src/services/github.ts)

A `postinstall` script in [`package.json`](./package.json) is used to install Playwright's browsers.

The script [`tests/interceptors/scripts/load.ts`](./tests/interceptors/scripts/load.ts) loads the interceptors and
fixtures before the application is started in development. It is included in the command `dev:mock` in
[`package.json`](./package.json).

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. Zimic is used to mock the
GitHub API and simulate a test case where the repository is found and another where it is not.

### Zimic

- GitHub interceptor and fixtures: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`src/app/__tests__/HomePage.e2e.test.ts`](./src/app/__tests__/HomePage.e2e.test.ts)
- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

### Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:zimicjs/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-playwright
   git pull origin main
   cd examples/with-playwright
   ```

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Run the tests:

   1. Start the application:

      ```bash
      pnpm run dev:mock
      ```

      After started, it will be available at [http://localhost:3002](http://localhost:3002).

   2. In another terminal, run the tests:

      ```bash
      pnpm run test --ui
      ```
