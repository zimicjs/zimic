<h1 align="center">
  Zimic - Examples
</h1>

<h2 align="center">
  With Vitest and Browser Mode
</h2>

This example demonstrates how to use Zimic with [Vitest](https://vitest.dev) with
[Browser Mode](https://vitest.dev/guide/browser) enabled. It uses [Playwright](https://playwright.dev) as the browser
provider for Vitest and [Testing Library](https://testing-library.com).

## Application

A simple HTML layout rendered by vanilla JavaScript, which uses the [GitHub API](https://docs.github.com/en/rest) to
fetch a repository.

- Application: [app.ts](./src/app.ts)

## Testing

An example test suite uses Vitest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

- Zimic

  - Zimic worker: [worker.ts](./tests/interceptors/worker.ts)
  - Zimic GitHub interceptor: [githubInterceptor.ts](./tests/interceptors/githubInterceptor.ts)

- Test:

  - Test suite: [example.test.ts](./tests/example.test.ts)
  - Vitest configuration: [vitest.config.ts](./vitest.config.mts)
    - Test setup file: [setup.ts](./tests/browserSetup.ts)
      > IMPORTANT: this setup file must be imported in each test file. Currently, Browser Mode is experimental and
      > Vitest is running the setup file in a different process than the test files, so the worker started
      > [here](./tests/browserSetup.ts#L9) is not shared between them.
