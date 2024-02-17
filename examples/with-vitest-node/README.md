<h1 align="center">
  Zimic - Examples
</h1>

<h2 align="center">
  With Vitest and Node.js
</h2>

This example demonstrates how to use Zimic with [Vitest](https://vitest.dev) in a server-side environment.
[Node.js](https://nodejs.org) is used in this example, but other runtimes should be similar, such as
[Deno](https://deno.com) and [Bun](https://bun.sh).

## Application

A simple [Fastify](https://fastify.dev) server, which uses the [GitHub API](https://docs.github.com/en/rest) to fetch
repositories. Any other Node.js framework could be used as well, such as [express](https://expressjs.com) and
[Nest.js](https://nestjs.com).

- Server: [app.ts](./src/app.ts)

## Testing

An example test suite uses Vitest to test the application. Zimic is used to mock the GitHub API and simulate a test case
where the repository is found and another where it is not.

- Zimic

  - Zimic worker: [worker.ts](./tests/interceptors/worker.ts)
  - Zimic GitHub interceptor: [githubInterceptor.ts](./tests/interceptors/githubInterceptor.ts)

- Test:

  - Test suite: [example.test.ts](./tests/example.test.ts)
  - Vitest configuration: [vitest.config.ts](./vitest.config.mts)
    - Test setup file: [setup.ts](./tests/setup.ts)
