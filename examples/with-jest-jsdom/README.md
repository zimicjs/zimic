<h1>
  Zimic + Jest + JSDOM
</h1>

This example uses Zimic with [Jest](https://jestjs.io), [JSDOM](https://github.com/jsdom/jsdom), and
[Testing Library](https://testing-library.com).

## Application

The application is a simple HTML layout rendered by vanilla JavaScript, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app.ts`](./src/app.ts)

## Testing

An example test suite uses Jest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

### Zimic

- GitHub interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Test

- Test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Jest configuration: [`jest.config.js`](./jest.config.js)
- Test environment: [`tests/environment.ts`](./tests/environment.ts)
- Test resolver: [`tests/resolver.js`](./tests/resolver.js)

> [!IMPORTANT]
>
> The flag `--experimental-vm-modules`, present in the command `test` in the [`package.json`](./package.json), is
> required by Jest because Zimic uses dynamic imports internally.

> [!IMPORTANT]
>
> This custom environment is necessary to expose the Global Fetch API resources, such as `fetch`, to the test context.
> [JSDOM currently does not expose them](https://github.com/jsdom/jsdom/issues/1724).

> [!IMPORTANT]
>
> JSDOM runs on Node.js, but uses browser imports when present. Therefore, this resolver is necessary to remove the
> [browser condition of MSW-related imports](https://github.com/mswjs/msw/issues/1786) to prevent test runtime errors."

## Running

1. Clone this example:

   ```bash
   mkdir zimic
   cd zimic
   git init
   git remote add origin git@github.com:zimicjs/zimic.git
   git sparse-checkout init
   git sparse-checkout set examples/with-jest-jsdom
   git pull origin canary # or a specific branch or tag
   cd examples/with-jest-jsdom
   ```

   If you'd like to clone the example of a previous version, replace `canary` with the desired branch or tag, such as
   `@zimic/interceptor@0` and `@zimic/fetch@0.1.0`.

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Run the tests:

   ```bash
   pnpm run test
   ```
