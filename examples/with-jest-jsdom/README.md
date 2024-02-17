<h1 align="center">
  Zimic - Examples
</h1>

<h2 align="center">
  With Jest and JSDOM
</h2>

This example demonstrates how to use Zimic with [Jest](https://jestjs.io), [JSDOM](https://github.com/jsdom/jsdom), and
[Testing Library](https://testing-library.com).

## Application

A simple HTML layout rendered by vanilla JavaScript, which uses the [GitHub API](https://docs.github.com/en/rest) to
fetch a repository.

- Application: [app.ts](./src/app.ts)

## Testing

An example test suite uses Jest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

- Zimic

  - Zimic worker: [worker.ts](./tests/interceptors/worker.ts)
  - Zimic GitHub interceptor: [githubInterceptor.ts](./tests/interceptors/githubInterceptor.ts)

- Test:

  - Test suite: [example.test.ts](./tests/example.test.ts)
  - Jest configuration: [jest.config.ts](./jest.config.js)
    - Test setup file: [setup.ts](./tests/setup.ts)
    - Test environment: [environment.ts](./tests/environment.ts)
      > This custom environment is necessary to expose the Global Fetch API resources, such as `fetch`, to the test
      > context. [JSDOM currently does not expose them](https://github.com/jsdom/jsdom/issues/1724).
    - Test resolver: [resolver.js](./tests/resolver.js)
      > JSDOM runs on Node.js, but uses browser imports when present. Therefore, this resolver is necessary to remove
      > the [browser condition of MSW-related imports](https://github.com/mswjs/msw/issues/1786) to prevent test runtime
      > errors.
