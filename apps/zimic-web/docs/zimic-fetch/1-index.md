---
title: Introduction | @zimic/fetch
sidebar_label: Introduction
slug: /fetch
---

# Introduction

`@zimic/fetch` is a minimal (~2 kB minified gzipped) and type-safe `fetch`-like API client.

[`createFetch`](/docs/zimic-fetch/api/1-create-fetch.md) takes your [`@zimic/http` schema](/docs/zimic-http/guides/1-schemas.md) and returns a thin wrapper around the native [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API). It accepts the same arguments as `fetch` and returns native requests and responses, so there is no new API to learn. Paths, parameters, bodies, and responses are typed by default.

## When to use

- You already use `fetch` and want type safety without adopting a larger HTTP client.
- You want response bodies typed by status code, without casting the result of `response.json()`.
- You need shared defaults, authentication, or retries across your requests.

## Highlights

- :zap: **Type-safe `fetch`**

  Use your [`@zimic/http` schema](/docs/zimic-http/guides/1-schemas.md) to create a type-safe [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client and have your requests and responses fully typed by default. Checking `response.status` narrows the type of the response body, which makes [handling errors](/docs/zimic-fetch/guides/6-errors.md) explicit.

- :sparkles: **Zero dependencies**

  `@zimic/fetch` has no external dependencies, making it a lightweight and fast alternative to other HTTP clients.

- :muscle: **Developer experience**

  Define default options to apply to your requests, such as a base URL, headers, search parameters, and more. Inspect and modify requests and responses using [`onRequest`](/docs/zimic-fetch/api/2-fetch.md#fetchonrequest) and [`onResponse`](/docs/zimic-fetch/api/2-fetch.md#fetchonresponse) listeners, for example to [authenticate requests](/docs/zimic-fetch/guides/5-authentication.md).

- :test_tube: **Testing**

  Mock the requests of your client with [`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md), typed by the same schema. See our [testing guide](/docs/zimic-fetch/guides/7-testing.md) for more information.

**Learn more**:

- [`@zimic/fetch` - Getting started](/docs/zimic-fetch/2-getting-started.mdx)
- [`@zimic/fetch` - Guides](/docs/fetch/guides)
- [`@zimic/fetch` - API](/docs/fetch/api)
