<h1>
  Zimic + Vitest + JSDOM
</h2>

This example uses Zimic with [Vitest](https://vitest.dev), [JSDOM](https://github.com/jsdom/jsdom), and
[Testing Library](https://testing-library.com).

## Application

A simple HTML layout rendered by vanilla JavaScript, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app.ts`](./src/app.ts)

## Testing

An example test suite uses Vitest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

### Zimic

- Zimic worker: [`tests/interceptors/worker.ts`](./tests/interceptors/worker.ts)
- Zimic GitHub interceptor: [`tests/interceptors/githubInterceptor.ts`](./tests/interceptors/githubInterceptor.ts)

### Test

- Test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)

#### Configuration

- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)
