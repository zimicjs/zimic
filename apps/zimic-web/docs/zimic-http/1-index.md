---
title: Introduction | @zimic/http
sidebar_label: Introduction
slug: /http
---

# Introduction

`@zimic/http` is a collection of type-safe utilities to handle HTTP requests and responses, including headers, search
params, and form data.

:::info Status: <span>**Beta** :seedling:</span>

:::

## Features

- :star: **HTTP schemas**

  Declare the structure of your endpoints in an [HTTP schema](/docs/zimic-http/guides/1-http-schemas.md) and use it to
  type your HTTP requests and responses.

- :bulb: **Type generation**

  Infer the types from [OpenAPI](https://www.openapis.org/) documentations and generate ready-to-use HTTP schemas in
  instants with our [typegen CLI](/docs/zimic-http/guides/3-typegen.mdx).

- :pushpin: **Type-safe APIs**

  Declare typed [`Headers`](/docs/zimic-http/api/2-http-headers.md),
  [`URLSearchParams`](/docs/zimic-http/api/3-http-search-params.md), and
  [`FormData`](/docs/zimic-http/api/4-http-form-data.md) objects, fully compatible with their native counterparts.

**Learn more**:

- [`@zimic/http` - Getting started](/docs/zimic-http/2-getting-started.mdx)
- [`@zimic/http` - Guides](/docs/http/guides)
- [`@zimic/http` - API](/docs/http/api)
- [`@zimic/http` - CLI](/docs/http/cli)
