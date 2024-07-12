<h1>
  Zimic + Vitest + JSDOM
</h2>

This example uses Zimic with [Vitest](https://vitest.dev), [JSDOM](https://github.com/jsdom/jsdom), and
[Testing Library](https://testing-library.com).

## Application

The application is a simple HTML layout rendered by vanilla JavaScript, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app.ts`](./src/app.ts)

## Testing

An example test suite uses Vitest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

### Zimic

- GitHub interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

## Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:zimicjs/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-vitest-jsdom
   git pull origin main
   cd examples/with-vitest-jsdom
   ```

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Run the tests:

   ```bash
   pnpm run test
   ```
