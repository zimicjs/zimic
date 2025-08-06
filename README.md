<p align="center">
  <img src="./docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  Zimic
</h1>

<p align="center">
  Next-gen TypeScript-first HTTP integrations
</p>

<p align="center">
  <a href="https://zimic.dev">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/4">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)

[![NPM Downloads - @zimic/http](https://img.shields.io/npm/dm/@zimic/http?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Fhttp&labelColor=353C43)](https://www.npmjs.com/package/@zimic/http)&nbsp;
[![Bundle size - @zimic/http](https://badgen.net/bundlephobia/minzip/@zimic/http?color=0E69BE&labelColor=353C43&label=@zimic/http%20min%20gzip)](https://bundlephobia.com/package/@zimic/http)<br />
[![NPM Downloads - @zimic/fetch](https://img.shields.io/npm/dm/@zimic/fetch?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Ffetch&labelColor=353C43)](https://www.npmjs.com/package/@zimic/fetch)&nbsp;
[![Bundle size - @zimic/fetch](https://badgen.net/bundlephobia/minzip/@zimic/fetch?color=0E69BE&labelColor=353C43&label=@zimic/fetch%20min%20gzip)](https://bundlephobia.com/package/@zimic/fetch)<br />
[![NPM Downloads - @zimic/interceptor](https://img.shields.io/npm/dm/@zimic/interceptor?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Finterceptor&labelColor=353C43)](https://www.npmjs.com/package/@zimic/interceptor)&nbsp;
[![Bundle size - @zimic/interceptor](https://badgen.net/bundlephobia/minzip/@zimic/interceptor?color=0E69BE&labelColor=353C43&label=@zimic/interceptor%20min%20gzip)](https://bundlephobia.com/package/@zimic/interceptor)&nbsp;

</div>

---

Zimic is a collection of TypeScript-first HTTP integration libraries.

## Highlights

- ⚙️ **TypeScript-first**

  Zimic has **first-class TypeScript support**, providing type safety, inference, validation, and autocompletion out of
  the box. "Typed by default" is one of the core principles of Zimic.

- ⚡ **Lightweight**

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

- :star: **HTTP schemas**

  Declare the structure of your endpoints in an [HTTP schema](https://zimic.dev/docs/http/guides/schemas) and use it to
  type your HTTP requests and responses.

- :bulb: **Type generation**

  Infer types from [OpenAPI](https://www.openapis.org) documentation and generate ready-to-use HTTP schemas with our
  [typegen CLI](https://zimic.dev/docs/http/guides/typegen).

- :pushpin: **Type-safe APIs**

  Declare typed [`Headers`](https://zimic.dev/docs/http/api/http-headers),
  [`URLSearchParams`](https://zimic.dev/docs/http/api/http-search-params), and
  [`FormData`](https://zimic.dev/docs/http/api/http-form-data) objects, fully compatible with their native counterparts.

**Learn more**:

- [`@zimic/http` - Introduction](https://zimic.dev/docs/http)
- [`@zimic/http` - Getting started](https://zimic.dev/docs/http/getting-started)
- [`@zimic/http` - Guides](https://zimic.dev/docs/http/guides)

### `@zimic/fetch`

A minimal (~2 kB minified and gzipped) and type-safe `fetch`-like API client.

- :zap: **Type-safe `fetch`**

  Use your [`@zimic/http` schema](https://zimic.dev/docs/http/guides/schemas) to create a type-safe
  [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client and have your requests and responses
  fully typed by default.

- :sparkles: **Zero dependencies**

  `@zimic/fetch` has no external dependencies, making it a lightweight and fast alternative to other HTTP clients.

- :muscle: **Developer experience**

  Define default options to apply to your requests, such as a base URL, headers, search parameters, and more. Inspect
  and modify requests and responses using [`onRequest`](https://zimic.dev/docs/fetch/api/fetch#onrequest) and
  [`onResponse`](https://zimic.dev/docs/fetch/api/fetch#onresponse) listeners.

**Learn more**:

- [`@zimic/fetch` - Introduction](https://zimic.dev/docs/fetch)
- [`@zimic/fetch` - Getting started](https://zimic.dev/docs/fetch/getting-started)
- [`@zimic/fetch` - Guides](https://zimic.dev/docs/fetch/guides)

### `@zimic/interceptor`

A type-safe interceptor library for handling and mocking HTTP requests in development and testing.

- :globe_with_meridians: **HTTP interceptors**

  Use your [`@zimic/http` schema](https://zimic.dev/docs/http/guides/schemas) to declare
  [local](https://zimic.dev/docs/interceptor/guides/interceptors/local) and
  [remote](https://zimic.dev/docs/interceptor/guides/interceptors/remote) HTTP interceptors. Mock external services and
  simulate success, loading, and error states with ease and type safety.

- :link: **Network-level interception**

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](https://zimic.dev/docs/interceptor/cli/server) to handle real HTTP requests. From you
  application's point of view, the mocked responses are indistinguishable from the real ones.

- :bulb: **Readability**

  `@zimic/interceptor` was designed to encourage clarity and readability in your mocks. Use
  [declarative assertions](https://zimic.dev/docs/interceptor/guides/declarative-assertions) to verify that your
  application is making the expected requests and test with confidence.

**Learn more**:

- [`@zimic/interceptor` - Introduction](https://zimic.dev/docs/interceptor)
- [`@zimic/interceptor` - Getting started](https://zimic.dev/docs/interceptor/getting-started)
- [`@zimic/interceptor` - Guides](https://zimic.dev/docs/interceptor/guides)

> [!TIP]
>
> `@zimic/fetch` and `@zimic/interceptor` work best together, providing a seamless and type-safe experience for making
> and mocking HTTP requests. With that in mind, it's perfectly possible to use `@zimic/interceptor` with any HTTP client
> implementation, or `@zimic/fetch` with any HTTP mocking library. See our
> [`@zimic/fetch` testing guide](https://zimic.dev/docs/fetch/guides/testing#zimicinterceptor) for more information.

## Examples

Visit our [examples](https://zimic.dev/docs/examples) to see how to use Zimic with popular frameworks, libraries, and
use cases.

## Sponsors

If you like Zimic and want to support the project, consider [becoming a sponsor](https://github.com/sponsors/zimicjs)!

[![Zimic Sponsors](./apps/zimic-web/public/images/sponsors.svg)](https://zimic.dev#sponsors)

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.

## Contributing

Interested in contributing to Zimic? Check out our [contributing guide](./CONTRIBUTING.md) to get started!
