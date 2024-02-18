<h1>
  Zimic + Vitest + Node.js
</h2>

This example uses Zimic with [Vitest](https://vitest.dev) in a server-side environment. [Node.js](https://nodejs.org) is
used in this example, but other runtimes should be similar, such as [Deno](https://deno.com) and [Bun](https://bun.sh).

## Application

A simple [Fastify](https://fastify.dev) server, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest). Any other Node.js framework could be used as well, such as
[express](https://expressjs.com) and [Nest.js](https://nestjs.com).

- Server: [`src/app.ts`](./src/app.ts)

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
