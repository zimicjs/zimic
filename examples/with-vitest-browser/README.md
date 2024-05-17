<h1>
  Zimic + Vitest + Browser Mode
</h2>

This example uses Zimic with [Vitest](https://vitest.dev) with [Browser Mode](https://vitest.dev/guide/browser) enabled.
It uses [Playwright](https://playwright.dev) as the browser provider for Vitest and
[Testing Library](https://testing-library.com).

## Application

The application is a simple HTML layout rendered by vanilla JavaScript, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app.ts`](./src/app.ts)

A `postinstall` in [`package.json`](./package.json) script is used to install Playwright's browsers and initialize
Zimic's mock service worker to the `./public` directory. The mock service worker at `./public/mockServiceWorker.js` is
ignored in the [`.gitignore`](./.gitignore) file.

## Testing

An example test suite uses Vitest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

### Zimic

- GitHub interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

> [!IMPORTANT]
>
> As a workaround, the setup file must be imported from each test file. Currently, Browser Mode is experimental and
> Vitest runs the setup file in a different process than the test files, so the worker started on
> [`tests/setup.ts`](./tests/setup.ts) is not shared between them.

### Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:diego-aquino/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-vitest-browser
   git pull origin main
   cd examples/with-vitest-browser
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Run the tests:

   ```bash
   npm run test
   ```
