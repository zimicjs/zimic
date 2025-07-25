---
title: Introduction
sidebar_label: Introduction
slug: /
---

# Introduction

Zimic is a collection of TypeScript-first HTTP integration libraries. It provides type-safe utilities to make, receive,
and mock HTTP requests and responses. Zimic is designed to be lightweight and easy to use, with built-in type inference
and validation.

## Motivation

Integrating with real-world HTTP APIs is very common in web development, yet keeping clients and servers in sync is
still a challenging task. Developers often have to rely on documentation, SDKs, or even source code review and
experimentation to declare correct types for the interactions with the API. In the end, we might end up with code like
this:

```ts
interface GitHubRepository {
  id: number;
  name: string;
  owner: { login: string };
}

// Let's fetch a repository from the GitHub API
const url = 'https://api.github.com/repos/zimicjs/zimic';
const response = await fetch(url);
const repository = (await response.json()) as GitHubRepository;

console.log(repository);
// { id: 721827056, name: 'zimic', owner: { ... }, ... }
```

One of the main issues with this approach is that the implementation is assuming many things about the structure of the
API, with little validation to check if these assumptions are correct:

- **Manual types**: the `GitHubRepository` interface is defined manually and can differ from the actual response, either
  by mistakes or by changes in the API.
- **Insufficient validation**: paths and parameters are not validated, so typos or changes in the API will cause runtime
  issues without any type errors during development.
- **Response casting**: the response body is manually cast to `GitHubRepository`, which can be repetitive, error-prone,
  and difficult to maintain.

In fact, did you spot the bug in this example? Because of the casting with `as`, the code assumes that the response data
will always be of type `GitHubRepository`, regardless of the status code. However, that is not the case. If the request
fails, the data can contain an error with a totally different structure!

```ts
const url = 'https://api.github.com/repos/zimicjs/i-dont-exist';
const response = await fetch(url);
const repository = (await response.json()) as GitHubRepository;

console.log(response.status); // 404
console.log(repository);
// { "message": "Not Found", "status": "404" } -- Oops
```

These issues are increased the more complex the API is and the more frequently it changes. As more endpoints are
integrated, the API structure can become diluted in hundreds of manual types, casts, and unchecked paths and property
names scattered across the codebase. This can clearly become a big maintenance burden, making it harder to keep the
types in sync with the API and causing bugs to go unnoticed.

This is where Zimic comes in.

Zimic was designed to minimize these problems by providing a type-safe and ergonomic way to interact with HTTP APIs. One
of the main concepts powering Zimic is the idea of a [centralized schema](/docs/zimic-http/guides/1-schemas.md), which
serves as a source of truth for the structure of your HTTP endpoints. It is declared in a readable format and can be
[autogenerated from OpenAPI](/docs/zimic-http/guides/2-typegen.mdx).

With Zimic, all requests, paths, parameters, and responses are type-checked using the schema, so that you can be
confident that your code is communicating with the API correctly. This makes it easy to catch errors early in the
development process without manually casting or checking types.

Since the schema is centralized and easy to understand, migrating to a new API version can be as simple as updating it
and refactoring which parts of the codebase start reporting type errors. The schema can also type and validate your
[network mocks](/docs/zimic-interceptor/1-index.md) during testing, ensuring that your application, your tests, and your
mocks are fully typed _by default_ and in sync with the API.

## Highlights

- :zap: **TypeScript-first**

  Zimic has **first-class TypeScript support**, providing type safety, inference, validation, and autocompletion out of
  the box. "Typed by default" is one of the core principles of Zimic.

- ⚙️ **Lightweight**

  The Zimic libraries are designed with minimal bundle sizes and few external dependencies in mind, making them perfect
  for both client and server-side applications.

- 📦 **Developer friendly**

  We believe that developer experience is key to building great applications. The Zimic API strives to be as simple and
  intuitive as possible, and we're always looking for ways to improve it.

- 🧪 **Thoroughly tested**

  Zimic has a comprehensive test suite and high code coverage. Testing is a main part of our development process, and we
  take reliability and developer confidence very seriously.

## Ecosystem

### `@zimic/http`

Type-safe utilities to handle HTTP requests and responses, including headers, search params, and form data.

:::info Status: <span>:bulb: **Release Candidate**</span>

:::

- :star: **HTTP schemas**

  Declare the structure of your endpoints in an [HTTP schema](/docs/zimic-http/guides/1-schemas.md) and use it to type
  your HTTP requests and responses.

- :bulb: **Type generation**

  Infer types from [OpenAPI](https://www.openapis.org) documentation and generate ready-to-use HTTP schemas with our
  [typegen CLI](/docs/zimic-http/guides/2-typegen.mdx).

- :pushpin: **Type-safe APIs**

  Declare typed [`Headers`](/docs/zimic-http/api/2-http-headers.md),
  [`URLSearchParams`](/docs/zimic-http/api/3-http-search-params.md), and
  [`FormData`](/docs/zimic-http/api/4-http-form-data.md) objects, fully compatible with their native counterparts.

**Learn more**:

- [`@zimic/http` - Introduction](/docs/zimic-http/1-index.md)
- [`@zimic/http` - Getting started](/docs/zimic-http/2-getting-started.mdx)
- [`@zimic/http` - Guides](/docs/http/guides)

### `@zimic/fetch`

A minimal (~2 kB minified and gzipped) and type-safe `fetch`-like API client.

:::info Status: <span>:bulb: **Release Candidate**</span>

:::

- :zap: **Type-safe `fetch`**

  Use your [`@zimic/http` schema](/docs/zimic-http/guides/1-schemas.md) to create a type-safe
  [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client and have your requests and responses
  fully typed by default.

- :sparkles: **Zero dependencies**

  `@zimic/fetch` has no external dependencies, making it a lightweight and fast alternative to other HTTP clients.

- :muscle: **Developer experience**

  Define default options to apply to your requests, such as a base URL, headers, search parameters, and more. Inspect
  and modify requests and responses using [`onRequest`](/docs/zimic-fetch/api/2-fetch.md#fetchonrequest) and
  [`onResponse`](/docs/zimic-fetch/api/2-fetch.md#fetchonresponse) listeners.

**Learn more**:

- [`@zimic/fetch` - Introduction](/docs/zimic-fetch/1-index.md)
- [`@zimic/fetch` - Getting started](/docs/zimic-fetch/2-getting-started.mdx)
- [`@zimic/fetch` - Guides](/docs/fetch/guides)

### `@zimic/interceptor`

A type-safe interceptor library for handling and mocking HTTP requests in development and testing.

:::info Status: <span>:bulb: **Release Candidate**</span>

:::

- :globe_with_meridians: **HTTP interceptors**

  Use your [`@zimic/http` schema](/docs/zimic-http/guides/1-schemas.md) to declare
  [local](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md) and
  [remote](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md) HTTP interceptors. Mock external services
  and simulate success, loading, and error states with ease and type safety.

- :link: **Network-level interception**

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](/docs/zimic-interceptor/cli/1-server.md) to handle real HTTP requests. From your application's
  point of view, the mocked responses are indistinguishable from the real ones.

- :bulb: **Readability**

  `@zimic/interceptor` was designed to encourage clarity and readability in your mocks. Use
  [declarative assertions](/docs/zimic-interceptor/guides/http/7-declarative-assertions.mdx) to verify that your
  application is making the expected requests and test with confidence.

**Learn more**:

- [`@zimic/interceptor` - Introduction](/docs/zimic-interceptor/1-index.md)
- [`@zimic/interceptor` - Getting started](/docs/zimic-interceptor/2-getting-started.mdx)
- [`@zimic/interceptor` - Guides](/docs/interceptor/guides)

:::tip TIP: <span>`@zimic/fetch` and `@zimic/interceptor` work best together</span>

`@zimic/fetch` and `@zimic/interceptor` are designed to work together, providing a seamless and type-safe experience for
making and mocking HTTP requests. With that in mind, it's perfectly possible to use `@zimic/interceptor` with any HTTP
client implementation, or `@zimic/fetch` with any HTTP mocking library. See our
[`@zimic/fetch` testing guide](/docs/zimic-fetch/guides/7-testing.md#zimicinterceptor) for more information.

:::

## Contributing

If you find an issue with this documentation of this project in general, feel free to
[open an issue](https://github.com/zimicjs/zimic/issues/new/choose). If you have a question, please
[open a discussion](https://github.com/zimicjs/zimic/discussions/new/choose) instead.

In case you are interested in contributing to Zimic, first of all, thank you! Check out or
[contributing guide](https://github.com/zimicjs/zimic/blob/canary/CONTRIBUTING.md) to get started. Please create an
issue or discussion before working on a new feature or bug fix. Let's make sure that your contribution is aligned with
the project's goals and vision first!
