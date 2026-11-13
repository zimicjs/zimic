---
title: Introduction | @zimic/http
sidebar_label: Introduction
slug: /http
---

# Introduction

`@zimic/http` is a collection of type-safe utilities to describe and handle HTTP requests and responses, including headers, search params, and form data.

At its core is the [HTTP schema](/docs/zimic-http/guides/1-schemas.md), a TypeScript type that declares the paths, methods, parameters, and responses of an API in one place. A schema is only a type, so it adds nothing to your bundle. Use it directly in your code, or share it with [`@zimic/fetch`](/docs/zimic-fetch/1-index.md) to make typed requests and with [`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md) to declare typed mocks.

## When to use

- You call or implement an HTTP API and want TypeScript to check its paths, parameters, and responses.
- Your API has [OpenAPI](https://www.openapis.org) documentation and you prefer generating types to writing them by hand.
- You want typed headers, search params, and form data without leaving the native APIs.

## Highlights

- :star: **HTTP schemas**

  Declare the structure of your endpoints in an [HTTP schema](/docs/zimic-http/guides/1-schemas.md) and use it to type your HTTP requests and responses. When the API changes, update the schema and the compiler points to the code that needs attention.

- :bulb: **Type generation**

  Infer the types from [OpenAPI](https://www.openapis.org) documentation, in a local file or a URL, and generate ready-to-use HTTP schemas with our [typegen CLI](/docs/zimic-http/guides/2-typegen.mdx).

- :pushpin: **Type-safe APIs**

  Declare typed [`Headers`](/docs/zimic-http/api/2-http-headers.md), [`URLSearchParams`](/docs/zimic-http/api/3-http-search-params.md), and [`FormData`](/docs/zimic-http/api/4-http-form-data.md) objects, fully compatible with their native counterparts.

**Learn more**:

- [`@zimic/http` - Getting started](/docs/zimic-http/2-getting-started.mdx)
- [`@zimic/http` - Guides](/docs/http/guides)
- [`@zimic/http` - API](/docs/http/api)
- [`@zimic/http` - CLI](/docs/http/cli)
