---
title: Introduction
sidebar_label: Introduction
slug: /
---

# Introduction

Zimic is a collection of TypeScript-first HTTP integration libraries. It provides type-safe utilities to handle HTTP
resources, including requests, responses, headers, search parameters, and form data. Zimic is designed to be
lightweight, flexible, robust, and easy to use, on top of a great developer experience from the ground up. The libraries
are built with TypeScript in mind, providing type safety, inference, validation, and autocompletion out of the box.

## Motivation

Integrating with real-world HTTP APIs is a common need in web applications, yet keeping clients and servers in sync is
still a challenging task. Without tools to help, developers often have to rely on documentation, code inspection, and
experimentation to manually declare and use the types of the APIs.

We've all seen code like this at some point:

```ts
interface GitHubRepository {
  id: number;
  name: string;
  owner: { login: string };
}

const GITHUB_BASE_URL = 'https://api.github.com';

const owner = 'zimicjs';
const repository = 'zimic';

// highlight-next-line
const response = await fetch(`${GITHUB_BASE_URL}/repos/${owner}/${repository}`);

// highlight-next-line
const repository = (await response.json()) as GitHubRepository;
console.log(repository);
```

The main issue with this approach is that the code is assuming a specific structure for the API response, with no
validation that it is correct.

- The `GitHubRepository` interface is defined manually and can be incorrect or differ from the actual API response as it
  evolves over time.
- The path and parameters of the request are not validated, so typos or changes in the API will lead to issues at
  runtime without any type errors.
- The response data is manually cast to `GitHubRepository`, which can be not only tedious, but error-prone. In fact, did
  you catch the bug in this code? Since the response status is not checked, the data can in fact not be
  `GitHubRepository` at all, but an error message or a different structure!

These issues are increased the more complex the API is, the more frequently it changes and how often the code uses it.
The lack of type safety and little to no validation may result in the API structure becoming diluted in hundreds of
manual types, casts, and hardcoded values scattered across the codebase. This can clearly become a big maintenance
burden and a source of bugs, because it can be really hard to keep the types and client code in sync with the API.

In light of these problems, Zimic was created to provide a type-safe and ergonomic way to work with HTTP APIs. One of
the main concepts behind Zimic is the idea of a [centralized schema](/docs/zimic-http/guides/1-http-schemas.md) to
define the structure of your HTTP endpoints. It can be automatically inferred from an
[OpenAPI documentation](https://www.openapis.org), if available, and serves as the source of truth for the types of your
API.

With Zimic, all requests, paths, parameters, and responses are inferred and validated from the schema, so you can have
much more confidence that your code is communicating with the API correctly, without any casts or manual `satisfies`
checks everywhere. Because of this, migrating to a new API version can be as simple as updating the centralized schema
and checking which parts of the codebase are reporting type errors. The schema can also be used to type and validate
your [HTTP mocks](/docs/zimic-interceptor/1-index.md), ensuring that both your application and your tests are fully
type-safe and in sync with the API.

## Features

- :zap: **Lightweight**:

  Zimic is designed to have a minimal bundle size and few external dependencies, making them perfect for client and
  server-side applications. No bloat, fast load times, and little memory and CPU footprint!

- :gear: **TypeScript-first**:

  Zimic has first-class support for TypeScript, providing type safety, inference, validation, and autocompletion out of
  the box. "Typed by default" is one of the main design principles of Zimic.

- :package: **Developer-friendly**:

  We believe that developer experience is key to building great applications. The Zimic API and CLI is designed to be as
  simple and intuitive as possible, and we're always looking for ways to improve and simplify it.

- :test_tube: **Thoroughly tested**:

  Zimic has a comprehensive test suite and high code coverage. Testing is a key part of our development process, and we
  take robustness, reliability, predictability, security, and developer confidence very seriously.

## Projects

Zimic is split into an ecosystem of packages. Some of them are designed to be used together, while others can be used
independently.

### `@zimic/http`

:::info Status: <span>**Beta** :seedling:</span>

:::

[`@zimic/http`](/docs/zimic-http/1-index.md) is a collection of type-safe utilities to handle HTTP requests and
responses, including headers, search params, and form data.

- :star: **HTTP schemas and typegen**:

  Declare the structure of your HTTP endpoints as a [TypeScript schema](/docs/zimic-http/guides/1-http-schemas.md) and
  use it to type your HTTP requests and responses. If you have an [OpenAPI v3](https://swagger.io/specification)
  declaration, [`zimic-http typegen`](/docs/zimic-http/guides/3-typegen.md) can automatically generate the types of your
  schema.

- :pushpin: **Type-safe native APIs**:

  Declare type-safe [`Headers`](/docs/zimic-http/api/2-http-headers.md),
  [`URLSearchParams`](/docs/zimic-http/api/3-http-search-params.md), and
  [`FormData`](/docs/zimic-http/api/4-http-form-data.md) objects, fully compatible with their native counterparts.

**Learn more**:

- [`@zimic/http` - Introduction](/docs/zimic-http/1-index.md)
- [`@zimic/http` - Getting started](/docs/zimic-http/2-getting-started.mdx)
- [`@zimic/http` - Guides](/docs/http/guides)

### `@zimic/fetch`

:::info Status: <span>**Beta** :seedling:</span>

:::

[`@zimic/fetch`](/docs/zimic-fetch/1-index.md) is a minimal (~2 kB minified and gzipped), zero-dependency, and type-safe
`fetch`-like API client.

- :sparkles: **Type-safe `fetch`**:

  Create a type-safe [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client. Use your
  [`@zimic/http` schema](/docs/zimic-http/guides/1-http-schemas.md) and have your requests and responses fully typed by
  default.

- :muscle: **Developer experience**:

  `@zimic/fetch` seeks to be as compatible with the
  [native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API) as possible, while providing an ergonomic
  interface to improve type safety. Define default options to apply to your requests, such as a base URL, headers,
  search parameters, and more. Inspect and modify requests and responses using
  [`onRequest`](/docs/zimic-fetch/api/2-fetch.md#onrequest) and
  [`onResponse`](/docs/zimic-fetch/api/2-fetch.md#onresponse) listeners.

**Learn more**:

- [`@zimic/fetch` - Introduction](/docs/zimic-fetch/1-index.md)
- [`@zimic/fetch` - Getting started](/docs/zimic-fetch/2-getting-started.mdx)
- [`@zimic/fetch` - Guides](/docs/fetch/guides)

### `@zimic/interceptor`

:::info Status: <span>**Beta** :seedling:</span>

:::

[`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md) provides a flexible and type-safe way to intercept and mock
HTTP requests.

- :globe_with_meridians: **HTTP interceptors**:

  Intercept HTTP requests and return mock responses. Use [local](/docs/zimic-interceptor/guides/1-local-interceptors.md)
  or [remote](/docs/zimic-interceptor/guides/2-remote-interceptors.md) interceptors to adapt your mocks to your
  development and testing workflow.

- :zap: **Fully typed mocks**:

  Use your [`@zimic/http` schema](/docs/zimic-http/guides/1-http-schemas.md) and create type-safe mocks for your HTTP
  requests.

- :link: **Network-level interceptor**:

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](/docs/zimic-interceptor/cli/1-server.md) to handle real HTTP requests. From you application's
  point of view, the mocked responses are indistinguishable from the real ones.

- :wrench: **Flexibility**:

  Mock external services and reliably test how your application behaves. Simulate success, loading, and error states
  with ease using [standard web APIs](https://developer.mozilla.org/docs/Web/API).

- :bulb: **Readability**:

  `@zimic/interceptor` was designed to encourage clarity and readability in your mocks. Have
  [declarative assertions](/docs/zimic-interceptor/guides/7-declarative-assertions.md) to verify that your application
  is making the expected requests.

**Learn more**:

- [`@zimic/interceptor` - Introduction](/docs/zimic-interceptor/1-index.md)
- [`@zimic/interceptor` - Getting started](/docs/zimic-interceptor/2-getting-started.mdx)
- [`@zimic/interceptor` - Guides](/docs/interceptor/guides)

:::tip TIP: <span>`@zimic/fetch` and `@zimic/interceptor` work best together</span>

`@zimic/fetch` and `@zimic/interceptor` are designed to work together, providing a seamless and type-safe experience for
performing HTTP requests and mocking them during development and testing.

However, it's perfectly possible to use `@zimic/interceptor` with any HTTP client implementation, such as
[axios](https://www.npmjs.com/package/axios). Similarly, `@zimic/fetch` can be used with any interceptor library, like
[msw](https://www.npmjs.com/package/msw).

:::

## Contributing

If you find an issue with this documentation of this project in general, feel free to
[open an issue](https://github.com/zimicjs/zimic/issues/new/choose). If you have a question, please
[open a discussion](https://github.com/zimicjs/zimic/discussions/new/choose) instead.

If you are interested in contributing to Zimic, check out or
[contributing guide](https://github.com/zimicjs/zimic/blob/canary/CONTRIBUTING.md) to get started. Please create an
issue or discussion before working on a new feature or bug fix. Let's make sure that your contribution is aligned with
the project's goals and vision first!
