---
title: Introduction | @zimic/fetch
sidebar_label: Introduction
slug: /fetch
---

# Introduction

`@zimic/fetch` is a minimal (~2 kB minified and gzipped) and type-safe `fetch`-like API client.

## Highlights

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

- [`@zimic/fetch` - Getting started](/docs/zimic-fetch/2-getting-started.mdx)
- [`@zimic/fetch` - Guides](/docs/fetch/guides)
- [`@zimic/fetch` - API](/docs/fetch/api)
