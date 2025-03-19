<p align="center">
  <img src="../../docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  @zimic/interceptor
</h1>

<p align="center">
  TypeScript-first HTTP intercepting and mocking
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zimic/interceptor">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/wiki">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/5">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)

[![NPM Downloads - @zimic/interceptor](https://img.shields.io/npm/dm/@zimic/interceptor?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Finterceptor&labelColor=353C43)](https://www.npmjs.com/package/@zimic/interceptor)&nbsp;
[![Bundle size - @zimic/interceptor](https://badgen.net/bundlephobia/minzip/@zimic/interceptor?color=0E69BE&labelColor=353C43&label=@zimic/interceptor%20min%20gzip)](https://bundlephobia.com/package/@zimic/interceptor)&nbsp;

</div>

---

- [Features](#features)
- [Getting started](#getting-started)
  - [Installation](#installation)
- [Basic usage](#basic-usage)
- [Documentation](#documentation)
- [Examples](#examples)
- [Changelog](#changelog)
- [Contributing](#contributing)

---

`@zimic/interceptor` provides a flexible and type-safe way to intercept and mock HTTP requests.

> [!NOTE]
>
> :seedling: This library is in **beta**.

## Features

- :globe_with_meridians: **HTTP interceptors**: Intercept HTTP requests and return mock responses. Use
  [local](https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors) or
  [remote](https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors) interceptors to adapt your
  mocks to your development and testing workflow.
- :zap: **Fully typed mocks**: Use your
  [`@zimic/http` schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http‐schemas) and create type-safe mocks for
  your HTTP requests.
- :link: **Network-level interceptor**: `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server) to handle real HTTP requests. From you
  application's point of view, the mocked responses are indistinguishable from the real ones.
- :wrench: **Flexibility**: Mock external services and reliably test how your application behaves. Simulate success,
  loading, and error states with ease using [standard web APIs](https://developer.mozilla.org/docs/Web/API).
- :bulb: **Simplicity**: `@zimic/interceptor` was designed to encourage clarity, simplicity, and robustness in your
  mocks.

## Getting started

Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started‐interceptor).

### Installation

| Manager | Command                                                 |
| :-----: | ------------------------------------------------------- |
|   npm   | `npm install @zimic/http @zimic/interceptor --save-dev` |
|  yarn   | `yarn add @zimic/http @zimic/interceptor --dev`         |
|  pnpm   | `pnpm add @zimic/http @zimic/interceptor --dev`         |

## Basic usage

1.  Declare your HTTP schema using [`@zimic/http`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http):

    ```ts
    import { type HttpSchema } from '@zimic/http';

    interface User {
      username: string;
    }

    interface RequestError {
      code: string;
      message: string;
    }

    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
            400: { body: RequestError };
            409: { body: RequestError };
          };
        };

        GET: {
          request: {
            headers: { authorization: string };
            searchParams: { query?: string; limit?: `${number}` };
          };
          response: {
            200: { body: User[] };
            400: { body: RequestError };
            401: { body: RequestError };
          };
        };
      };

      '/users/:userId': {
        PATCH: {
          request: {
            headers: { authorization: string };
            body: Partial<User>;
          };
          response: {
            204: {};
            400: { body: RequestError };
          };
        };
      };
    }>;
    ```

    You can also use [`zimic-http typegen`](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐typegen) to automatically
    generate types for your HTTP schema.

2.  Create your
    [interceptor](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#createhttpinterceptoroptions):

    ```ts
    import { createHttpInterceptor } from '@zimic/interceptor/http';

    const interceptor = createHttpInterceptor<Schema>({
      type: 'local',
      baseURL: 'http://localhost:3000',
    });
    ```

3.  Manage your [interceptor lifecycle](https://github.com/zimicjs/zimic/wiki/guides‐testing‐interceptor):

    4.1.
    [Start intercepting requests](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstart):

    ```ts
    beforeAll(async () => {
      await interceptor.start();
    });
    ```

    4.2.
    [Clear your interceptors](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear) so
    that no tests affect each other:

    ```ts
    beforeEach(() => {
      interceptor.clear();
    });
    ```

    4.3.
    [Check that all expected requests were made](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorchecktimes):

    ```ts
    afterEach(() => {
      interceptor.checkTimes();
    });
    ```

    4.4.
    [Stop intercepting requests](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstop):

    ```ts
    afterAll(async () => {
      await interceptor.stop();
    });
    ```

4.  Enjoy mocking!

    5.1. Mock a response:

    ```ts
    test('example', async () => {
      const users: User[] = [{ username: 'me' }];

      const handler = interceptor
        .get('/users')
        .with({
          headers: { authorization: 'Bearer my-token' },
          searchParams: { query: 'u' },
        })
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      /// ...
    });
    ```

    Learn more about
    [`with(restrictions)`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction),
    [`respond(declaration)`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerresponddeclaration),
    and [`times(times)`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes).

    5.2. After your application made requests, check if they are as you expect:

    ```ts
    test('example', async () => {
      // Your application makes requests...

      expect(handler.requests).toHaveLength(1);

      expect(handler.requests[0].headers.get('authorization')).toBe('Bearer my-token');

      expect(handler.requests[0].searchParams.size).toBe(1);
      expect(handler.requests[0].searchParams.get('username')).toBe('my');

      expect(handler.requests[0].body).toBe(null);
    });
    ```

> [!NOTE]
>
> Step 5.2 manually verifies the requests made by the application. This is optional in this example because the
> [`with`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction) and
> [`times`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes) calls (step 5.1) already
> act as a declarative validation, expressing that exactly one request is expected with specific data. If fewer or more
> requests are received, the test will fail when
> [`interceptor.checkTimes()`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorchecktimes)
> is called in the `afterEach` hook.

## Documentation

- [Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started‐interceptor)
- [API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http)
- CLI reference
  - [Browser](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐browser)
  - [Server](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server)
- Guides
  - [Testing](https://github.com/zimicjs/zimic/wiki/guides‐testing‐interceptor)

## Examples

Visit our [examples](../../examples/README.md) to see how to use Zimic with popular frameworks, libraries, and use
cases.

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.

## Contributing

Interested in contributing to Zimic? Check out our [contributing guide](../../CONTRIBUTING.md) to get started!
