---
slug: /
---

# Introduction

Zimic is a set of modern, lightweight, TypeScript-first, and thoroughly tested HTTP integration libraries.

## Motivation

:::info

🚧 This section is a work in progress.

:::

## Features

:::info

🚧 This section is a work in progress.

:::

## Design principles

:::info

🚧 This section is a work in progress.

:::

## Projects

### `@zimic/http`

:::info Status: <span>**Beta** :seedling:</span>

:::

[`@zimic/http`](/docs/zimic-http/1-index.md) is a collection of type-safe utilities to handle HTTP requests and
responses, including headers, search params, and form data.

- :star: **HTTP schemas and typegen**: Declare the structure of your HTTP endpoints as a
  [TypeScript schema](/docs/zimic-http/guides/1-http-schemas.md) and use it to type your HTTP requests and responses. If
  you have an [OpenAPI v3](https://swagger.io/specification) declaration,
  [`zimic-http typegen`](/docs/zimic-http/guides/3-typegen.md) can automatically generate the types of your schema.
- :pushpin: **Type-safe native APIs**: Declare type-safe [`Headers`](/docs/zimic-http/api/2-http-headers.md),
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

- :sparkles: **Type-safe `fetch`**: Create a type-safe
  [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client. Use your
  [`@zimic/http` schema](/docs/zimic-http/guides/1-http-schemas.md) and have your requests and responses fully typed by
  default.
- :muscle: **Developer experience**: `@zimic/fetch` seeks to be as compatible with the
  [native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API) as possible, while providing an ergonomic
  interface to improve type safety. Define default options to apply to your requests, such as a base URL, headers,
  search parameters, and more. Inspect and modify requests and responses using
  [`onRequest`](/docs/zimic-fetch/api/2-fetch.md#onrequest) and
  [`onResponse`](/docs/zimic-fetch/api/2-fetch.md#onresponse) listeners.

**Learn more**:

- [`@zimic/fetch` - Introduction](/docs/zimic-fetch/1-index.md)
- [`@zimic/fetch` - Getting started](/docs/zimic-fetch/2-getting-started.md)
- [`@zimic/fetch` - Guides](/docs/fetch/guides)

### `@zimic/interceptor`

:::info Status: <span>**Beta** :seedling:</span>

:::

[`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md) provides a flexible and type-safe way to intercept and mock
HTTP requests.

- :globe_with_meridians: **HTTP interceptors**: Intercept HTTP requests and return mock responses. Use
  [local](/docs/zimic-interceptor/guides/1-local-interceptors.md) or
  [remote](/docs/zimic-interceptor/guides/2-remote-interceptors.md) interceptors to adapt your mocks to your development
  and testing workflow.
- :zap: **Fully typed mocks**: Use your [`@zimic/http` schema](/docs/zimic-http/guides/1-http-schemas.md) and create
  type-safe mocks for your HTTP requests.
- :link: **Network-level interceptor**: `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](/docs/zimic-interceptor/cli/1-server.md) to handle real HTTP requests. From you application's
  point of view, the mocked responses are indistinguishable from the real ones.
- :wrench: **Flexibility**: Mock external services and reliably test how your application behaves. Simulate success,
  loading, and error states with ease using [standard web APIs](https://developer.mozilla.org/docs/Web/API).
- :bulb: **Simplicity**: `@zimic/interceptor` was designed to encourage clarity, simplicity, and robustness in your
  mocks.

**Learn more**:

- [`@zimic/interceptor` - Introduction](/docs/zimic-interceptor/1-index.md)
- [`@zimic/interceptor` - Getting started](/docs/zimic-interceptor/2-getting-started.md)
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
