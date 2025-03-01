<p align="center">
  <img src="./docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  Zimic
</h1>

<p align="center">
  TypeScript-first HTTP integrations
</p>

<p align="center">
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
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)

[![NPM Downloads - @zimic/http](https://img.shields.io/npm/dm/@zimic/http?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Fhttp&labelColor=353C43)](https://www.npmjs.com/package/@zimic/http)&nbsp;
[![Bundle size - @zimic/http](https://badgen.net/bundlephobia/minzip/@zimic/http?color=0E69BE&labelColor=353C43&label=@zimic/http%20min%20gzip)](https://bundlephobia.com/package/@zimic/http)<br />
[![NPM Downloads - @zimic/fetch](https://img.shields.io/npm/dm/@zimic/fetch?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Ffetch&labelColor=353C43)](https://www.npmjs.com/package/@zimic/fetch)&nbsp;
[![Bundle size - @zimic/fetch](https://badgen.net/bundlephobia/minzip/@zimic/fetch?color=0E69BE&labelColor=353C43&label=@zimic/fetch%20min%20gzip)](https://bundlephobia.com/package/@zimic/fetch)<br />
[![NPM Downloads - @zimic/interceptor](https://img.shields.io/npm/dm/@zimic/interceptor?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Finterceptor&labelColor=353C43)](https://www.npmjs.com/package/@zimic/interceptor)&nbsp;
[![Bundle size - @zimic/interceptor](https://badgen.net/bundlephobia/minzip/@zimic/interceptor?color=0E69BE&labelColor=353C43&label=@zimic/interceptor%20min%20gzip)](https://bundlephobia.com/package/@zimic/interceptor)&nbsp;

</div>

---

## Contents <!-- omit from toc -->

- [Libraries](#libraries)
  - [`@zimic/http`](#zimichttp)
  - [`@zimic/fetch`](#zimicfetch)
  - [`@zimic/interceptor`](#zimicinterceptor)
- [Examples](#examples)
- [Changelog](#changelog)

---

Zimic is a set of lightweight, thoroughly tested, TypeScript-first HTTP integration libraries.

## Libraries

### `@zimic/http`

> :loudspeaker: Beta

[`@zimic/http`](./packages/zimic-http) is a collection of utilities to work with type-safe HTTP resources, such as
requests, responses, headers, search params, and form data.

- :star: **HTTP schemas and typegen**: Declare the structure of your HTTP endpoints as a TypeScript
  [schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http‐schemas) and use it to type your HTTP requests and
  responses. If you have an [OpenAPI v3](https://swagger.io/specification) schema,
  [`zimic-http typegen`](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐typegen) can automatically generate the types
  of your schema.
- :pushpin: **Type-safe native HTTP APIs**: Declare type-safe
  [`Headers`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpheaders),
  [`URLSearchParams`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpsearchparams), and
  [`FormData`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpformdata) objects, fully compatible with their
  native counterparts.

**Learn more**:

- [`@zimic/http` - Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started‐http)
- [`@zimic/http` - API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http)
- `@zimic/http` - CLI reference
  - [Typegen](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐typegen)

### `@zimic/fetch`

> :construction: Experimental

[`@zimic/fetch`](./packages/zimic-fetch) is a minimal (1 kB minified and gzipped), zero-dependency, and type-safe
`fetch`-like API client.

- :sparkles: **Type-safe `fetch`**: Create a type-safe
  [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client. Import your `@zimic/http`
  [schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http‐schemas) and have your requests and responses fully
  typed by default.
- :muscle: **Developer experience**: While mostly compatible with the
  [native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API), `@zimic/fetch` provides a more ergonomic
  interface for common use cases. Define defaults to apply to all of your requests, such as a base URL, headers, search
  parameters, and more. Inspect and modify requests and responses using `onRequest` and `onResponse` listeners.

**Learn more**:

- [`@zimic/fetch` - Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started‐fetch)
- [`@zimic/fetch` - API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch)

### `@zimic/interceptor`

> :loudspeaker: Beta

[`@zimic/interceptor`](./packages/zimic-interceptor) provides a flexible and type-safe way to intercept and mock HTTP
requests.

- :globe_with_meridians: **HTTP interceptors**: Intercept HTTP requests and return mock responses. Use
  [local](https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors) or
  [remote](https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors) interceptors to adapt your
  mocks to your development and testing workflow.
- :zap: **Fully typed mocks**: Import your `@zimic/http`
  [schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http‐schemas) and create type-safe mocks for your HTTP
  requests.
- :link: **Network-level interceptor**: `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server) to handle real HTTP requests. From you
  application's point of view, the mocked responses are indistinguishable from the real ones.
- :wrench: **Flexibility**: Mock external services and reliably test how your application behaves. Simulate success,
  loading, and error states with ease using [standard web APIs](https://developer.mozilla.org/docs/Web/API).
- :bulb: **Simplicity**: `@zimic/interceptor` was designed to encourage clarity, simplicity, and robustness in your
  mocks. Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started‐interceptor) and
  starting mocking!

> [!TIP]
>
> `@zimic/fetch` and `@zimic/interceptor` are not required to be used together. `@zimic/interceptor` is compatible with
> any HTTP client implementation, such as [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and
> [`axios`](https://www.npmjs.com/package/axios). Similarly, `@zimic/fetch` works with any HTTP interceptor library,
> such as [`msw`](https://www.npmjs.com/package/msw) and [`nock`](https://www.npmjs.com/package/nock).
>
> With that in mind, `@zimic/fetch` and `@zimic/interceptor` work best together, providing a seamless and type-safe
> experience for making HTTP requests in your application and mocking them during development and testing.

**Learn more**:

- [`@zimic/interceptor` - Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started‐interceptor)
- [`@zimic/interceptor` - API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http)
- `@zimic/interceptor` - CLI reference
  - [Browser](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐browser)
  - [Server](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server)
- `@zimic/interceptor` - Guides
  - [Testing](https://github.com/zimicjs/zimic/wiki/guides‐testing‐interceptor)

## Examples

Visit our [examples](./examples/README.md) to see how to use Zimic with popular frameworks, libraries, and use cases.

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.
