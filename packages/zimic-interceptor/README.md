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
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)
[![NPM Downloads](https://img.shields.io/npm/dm/@zimic/interceptor?style=flat&logo=npm&color=0E69BE&label=Downloads&labelColor=353C43)](https://www.npmjs.com/package/@zimic/interceptor)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)&nbsp;

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

`@zimic/interceptor` is a lightweight, thoroughly tested, TypeScript-first HTTP request interceptor and mock library.

## Features

`@zimic/interceptor` provides a flexible and type-safe way to intercept and mock HTTP requests.

- :zap: **Fully typed mocks**: Declare the
  [schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas) of your HTTP endpoints and have
  your mocks 100% type-checked by default. Have [OpenAPI v3](https://swagger.io/specification) schema?
  [`zimic-http typegen`](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐typegen) can automatically generate types to
  keep your mocks in sync with your API.
- :link: **Network-level interceptor**: `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server) to handle real HTTP requests. From you
  application's point of view, the mocked responses are indistinguishable from the real ones.
- :wrench: **Flexible**: Mock external services and reliably test how your application behaves. Simulate success,
  loading, and error states with ease using [standard web APIs](https://developer.mozilla.org/docs/Web/API).
- :bulb: **Simple**: `@zimic/interceptor` was designed to encourage clarity, simplicity, and robustness in your mocks.
  Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started) and starting mocking!

## Getting started

Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started‐interceptor).

### Installation

| Manager | Command                                                 |
| :-----: | ------------------------------------------------------- |
|   npm   | `npm install @zimic/http @zimic/interceptor --save-dev` |
|  yarn   | `yarn add @zimic/http @zimic/interceptor --dev`         |
|  pnpm   | `pnpm add @zimic/http @zimic/interceptor --dev`         |

Note that `@zimic/interceptor` requires `@zimic/http` as a peer dependency.

## Basic usage

1.  Declare your types:

    ```ts
    interface User {
      username: string;
    }

    interface RequestError {
      code: string;
      message: string;
    }
    ```

2.  Declare your HTTP schema using `@zimic/http`
    ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas)):

    ```ts
    import { type HttpSchema } from '@zimic/http';

    type MySchema = HttpSchema<{
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
            searchParams: { username?: string; limit?: `${number}` };
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

3.  Create your interceptor
    ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptorcreateoptions)):

    ```ts
    import { httpInterceptor } from '@zimic/interceptor/http';

    const interceptor = httpInterceptor.create<MySchema>({
      type: 'local',
      baseURL: 'http://localhost:3000',
      saveRequests: true, // Allow access to `handler.requests()`
    });
    ```

4.  Manage your interceptor lifecycle ([learn more](https://github.com/zimicjs/zimic/wiki/guides‐testing)):

    4.1. Start intercepting requests
    ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstart)):

    ```ts
    beforeAll(async () => {
      await interceptor.start();
    });
    ```

    4.2. Clear interceptors so that no tests affect each other
    ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear)):

    ```ts
    beforeEach(() => {
      interceptor.clear();
    });
    ```

    4.3. Check that all expected requests were made
    ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorchecktimes)):

    ```ts
    afterEach(() => {
      interceptor.checkTimes();
    });
    ```

    4.4. Stop intercepting requests
    ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstop)):

    ```ts
    afterAll(async () => {
      await interceptor.stop();
    });
    ```

5.  Enjoy mocking!

    ```ts
    test('example', async () => {
      const users: User[] = [{ username: 'my-user' }];

      // Declare your mocks:
      // https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath
      const handler = interceptor
        .get('/users')
        // Use restrictions to make declarative assertions and narrow down your mocks:
        // https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction
        .with({
          headers: { authorization: 'Bearer my-token' },
          searchParams: { username: 'my' },
        })
        // Respond with your mock data:
        // https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerresponddeclaration
        .respond({
          status: 200,
          body: users,
        })
        // Define how many requests you expect your application to make:
        // https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes
        .times(1);

      // Run your application and make requests:
      // ...

      // Check the requests you expect:
      // https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrequests
      //
      // NOTE: The code below checks the requests manually. This is optional in this
      // example because the `with` and `times` calls act as a declarative validation,
      // meaning that exactly one request is expected with specific data. If fewer or
      // more requests are received, the test will fail when `interceptor.checkTimes()`
      // is called in the `afterEach` hook.
      const requests = handler.requests();
      expect(requests).toHaveLength(1);

      expect(requests[0].headers.get('authorization')).toBe('Bearer my-token');

      expect(requests[0].searchParams.size).toBe(1);
      expect(requests[0].searchParams.get('username')).toBe('my');

      expect(requests[0].body).toBe(null);
    });
    ```

## Documentation

- [Introduction](https://github.com/zimicjs/zimic/wiki)
- [Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started‐interceptor)
- [API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http)
- CLI reference
  - [Browser](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐browser)
  - [Server](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server)
- Guides
  - [Testing](https://github.com/zimicjs/zimic/wiki/guides‐testing)

## Examples

Visit our [examples](../../examples/README.md) to see how to use Zimic with popular frameworks, libraries, and use
cases.

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.

## Contributing

Interested in contributing to Zimic? Check out our [contributing guide](../../CONTRIBUTING.md) to get started!
