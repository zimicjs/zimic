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

The script [`tests/interceptors/scripts/load.ts`](./tests/interceptors/scripts/load.ts) loads the interceptors and mocks
before the application is started in development. It is used by the command `dev:mock` in
[`package.json`](./package.json).

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. Zimic is used to mock the
GitHub API and simulate a test case where the repository is found and another where it is not.

### Zimic

- GitHub interceptor and mocks: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`src/__tests__/HomePage.e2e.test.ts`](./src/__tests__/HomePage.e2e.test.ts)
- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

### Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:zimicjs/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-next-js-app
   git pull origin main
   cd examples/with-next-js-app
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

      After started, the application will be available at [http://localhost:3004](http://localhost:3004).

   2. In another terminal, run the tests:

      ```bash
      pnpm run test --ui
      ```
