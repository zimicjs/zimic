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

## Basic usage

1.  Declare your types:

    ```ts
    import { type HttpSchema } from '@zimic/http';
    import { httpInterceptor } from '@zimic/interceptor/http';

    interface User {
      username: string;
    }

    interface RequestError {
      code: string;
      message: string;
    }
    ```

2.  Declare your HTTP schema ([learn more](https://bit.ly/zimic-interceptor-http-schemas)):

    ```ts
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

3.  Create your interceptor ([learn more](https://bit.ly/zimic-interceptor-http#httpinterceptorcreateoptions)):

    ```ts
    const myInterceptor = httpInterceptor.create<MySchema>({
      type: 'local',
      baseURL: 'http://localhost:3000',
      saveRequests: true, // Allow access to `handler.requests()`
    });
    ```

4.  Manage your interceptor lifecycle ([learn more](https://bit.ly/zimic-guides-testing)):

    4.1. Start intercepting requests ([learn more](https://bit.ly/zimic-interceptor-http#http-interceptorstart)):

    ```ts
    beforeAll(async () => {
      await myInterceptor.start();
    });
    ```

    4.2. Clear interceptors so that no tests affect each other
    ([learn more](https://bit.ly/zimic-interceptor-http#http-interceptorclear)):

    ```ts
    beforeEach(() => {
      myInterceptor.clear();
    });
    ```

    4.3. Check that all expected requests were made
    ([learn more](https://bit.ly/zimic-interceptor-http#http-interceptorchecktimes)):

    ```ts
    afterEach(() => {
      myInterceptor.checkTimes();
    });
    ```

    4.4. Stop intercepting requests ([learn more](https://bit.ly/zimic-interceptor-http#http-interceptorstop)):

    ```ts
    afterAll(async () => {
      await myInterceptor.stop();
    });
    ```

5.  Enjoy mocking!

    ```ts
    test('example', async () => {
      const users: User[] = [{ username: 'my-user' }];

      // Declare your mocks:
      // https://bit.ly/zimic-interceptor-http#http-interceptormethodpath
      const myHandler = myInterceptor
        .get('/users')
        // Use restrictions to make declarative assertions and narrow down your mocks:
        // https://bit.ly/zimic-interceptor-http#http-handlerwithrestriction
        .with({
          headers: { authorization: 'Bearer my-token' },
          searchParams: { username: 'my' },
        })
        // Respond with your mock data:
        // https://bit.ly/zimic-interceptor-http#http-handlerresponddeclaration
        .respond({
          status: 200,
          body: users,
        })
        // Define how many requests you expect your application to make:
        // https://bit.ly/zimic-interceptor-http#http-handlertimes
        .times(1);

      // Run your application and make requests:
      // ...

      // Check the requests you expect:
      // https://bit.ly/zimic-interceptor-http#http-handlerrequests
      //
      // NOTE: The code below checks the requests manually. This is optional in this
      // example because the `with` and `times` calls act as a declarative validation,
      // meaning that exactly one request is expected with specific data. If fewer or
      // more requests are received, the test will fail when `myInterceptor.checkTimes()`
      // is called in the `afterEach` hook.
      const requests = myHandler.requests();
      expect(requests).toHaveLength(1);

      expect(requests[0].headers.get('authorization')).toBe('Bearer my-token');

      expect(requests[0].searchParams.size).toBe(1);
      expect(requests[0].searchParams.get('username')).toBe('my');

      expect(requests[0].body).toBe(null);
    });
    ```

## Getting started

Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started).

### Installation

| Manager | Command                                                 |
| :-----: | ------------------------------------------------------- |
|   npm   | `npm install @zimic/http @zimic/interceptor --save-dev` |
|  yarn   | `yarn add @zimic/http @zimic/interceptor --dev`         |
|  pnpm   | `pnpm add @zimic/http @zimic/interceptor --dev`         |

`@zimic/interceptor` requires `@zimic/http` as a peer dependency.

## Documentation

- [Introduction](https://github.com/zimicjs/zimic/wiki)
- [Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started)
- [API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic)
- [CLI reference](https://github.com/zimicjs/zimic/wiki/cli‐zimic)
- Guides
  - [Testing](https://github.com/zimicjs/zimic/wiki/guides‐testing)

> [!NOTE]
>
> Zimic has gone a long way in v0, but we're not yet v1!
>
> Reviews and improvements to the public API are possible, so breaking changes may **_exceptionally_** land without a
> major release during v0. Despite of that, we do not expect big mental model shifts. Usually, migrating to a new Zimic
> release requires minimal to no refactoring. During v0, we will follow these guidelines:
>
> - Breaking changes, if any, will be delivered in the next **_minor_** version.
> - Breaking changes, if any, will be documented in the [version release](https://github.com/zimicjs/zimic/releases),
>   along with a migration guide detailing the introduced changes and suggesting steps to migrate.

## What is `@zimic/interceptor` for?

`@zimic/interceptor` is a development and testing tool that helps you mock HTTP responses in a type-safe way. Some of
our best use cases:

- **Testing**: If your application relies on external services over HTTP, you can mock them with Zimic to make your
  tests simpler, faster and more predictable. Each interceptor references a
  [schema declaration](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas) to provide type
  inference and validation for your mocks. After breaking changes, adapting the interceptor schema will help you to
  quickly identify all of the affected mocks and keep your test scenarios consistent with the real-life API.
- **Development**: If you are developing a feature that depends on an external service that is unreliable, unavailable,
  or costly, you can use Zimic to mock it and continue your development without interruptions. Zimic can also be used to
  create mock servers, using
  [remote interceptors](https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors) and
  [interceptor servers](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server), which can be accessible by multiple
  applications in your development workflow and even be containerized.

## How does `@zimic/interceptor` work?

`@zimic/interceptor` allows you to intercept HTTP requests and return mock responses. In
[local HTTP interceptors](https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors), Zimic uses
[MSW](https://github.com/mswjs/msw) to intercept requests in the same process as your application. In
[remote HTTP interceptors](https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors), Zimic uses a
dedicated local [interceptor server](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server) to handle requests. This
opens up more possibilities for mocking, such as handling requests from multiple applications. Both of those strategies
act on real HTTP requests _after_ they leave your application, so no parts of your application code are skipped and you
can get more confidence in your tests.

## Examples

Visit our [examples](../../examples/README.md) to see how to use Zimic with popular frameworks, libraries, and use
cases!

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.

## Contributing

Interested in contributing to Zimic? Check out our [contributing guide](../../CONTRIBUTING.md) to get started!
