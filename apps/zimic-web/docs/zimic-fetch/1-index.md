---
title: Introduction | @zimic/fetch
sidebar_label: Introduction
slug: /fetch
---

# Introduction

[`@zimic/fetch`](/docs/zimic-fetch/1-index.md) is a minimal (~2 kB minified and gzipped) and type-safe `fetch`-like API
client.

:::info Status: <span>**Beta** :seedling:</span>

:::

## Features

- :sparkles: **Type-safe `fetch`**

  Create a type-safe [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client. Use your
  [`@zimic/http` schema](/docs/zimic-http/guides/1-http-schemas.md) and have your requests and responses fully typed by
  default.

- :zap: **Zero dependencies**

  `@zimic/fetch` has no external dependencies, making it a lightweight and fast alternative to other HTTP clients.

- :muscle: **Developer experience**

  `@zimic/fetch` seeks to be as compatible with the
  [native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API) as possible, while providing an ergonomic
  interface to improve type safety. Define default options to apply to your requests, such as a base URL, headers,
  search parameters, and more. Inspect and modify requests and responses using
  [`onRequest`](/docs/zimic-fetch/api/2-fetch.md#onrequest) and
  [`onResponse`](/docs/zimic-fetch/api/2-fetch.md#onresponse) listeners.

**Learn more**:

- [`@zimic/fetch` - Getting started](/docs/zimic-fetch/2-getting-started.mdx)
- [`@zimic/fetch` - Guides](/docs/fetch/guides)
- [`@zimic/fetch` - API](/docs/fetch/api)
- [`@zimic/fetch` - CLI](/docs/fetch/cli)
