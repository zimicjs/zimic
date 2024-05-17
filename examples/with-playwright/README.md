<h1>
  Zimic + Playwright
</h2>

This example uses Zimic with [Playwright](https://playwright.dev) for end-to-end tests. The tested application was build
using [Next.js](https://nextjs.org).

## Application

A simple [Next.js](https://nextjs.org) application, using both the [App Router](https://nextjs.org/docs/app) and
fetching repositories from the [GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app/page.tsx`](./src/app/page.tsx)
- GitHub fetch: [`src/services/github.ts`](./src/services/github.ts)

A `postinstall` in [`package.json`](./package.json) script is used to install Playwright's browsers.

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. Zimic is used to mock the
GitHub API and simulate a test case where the repository is found and another where it is not.

### Zimic

- GitHub interceptor: [`tests/interceptors/github/interceptor.ts`](./tests/interceptors/github/interceptor.ts)
  - Fixtures: [`tests/interceptors/github/fixtures.ts`](./tests/interceptors/github/fixtures.ts)

### Test

- Test suite: [`src/app/__tests__/HomePage.e2e.test.ts`](./src/app/__tests__/HomePage.e2e.test.ts)

- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
  - This file is responsible for starting the Zimic interceptors before each test. It also applies default mock
    responses based on the [fixtures](./tests/interceptors/github/interceptor.ts).

> [!IMPORTANT]
>
> The setup file must be imported in each test file to apply the global `test.beforeAll` and `test.afterAll`.

- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

### Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:diego-aquino/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-playwright
   git pull origin main
   cd examples/with-playwright
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Run the tests:

   1. Start the application:

      ```bash
      npm run dev:test
      ```

   2. In another terminal, run the tests:

      ```bash
      npm run test --ui
      ```
