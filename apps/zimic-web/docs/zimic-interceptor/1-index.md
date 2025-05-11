---
title: Introduction | @zimic/interceptor
sidebar_label: Introduction
slug: /interceptor
---

# Introduction

[`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md) provides a readable and type-safe way to intercept and mock
HTTP requests.

:::info Status: <span>**Beta** :seedling:</span>

:::

## Features

- :globe_with_meridians: **HTTP interceptors**

  Use [local](/docs/zimic-interceptor/guides/1-local-interceptors.md) or
  [remote](/docs/zimic-interceptor/guides/2-remote-interceptors.md) interceptors to mock external services and simulate
  success, loading, and error states with ease. Use your
  [`@zimic/http` schema](/docs/zimic-http/guides/1-http-schemas.md) and have your requests and responses fully typed by
  default.

- :link: **Network-level interception**

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](/docs/zimic-interceptor/cli/1-server.md) to handle real HTTP requests. From you application's
  point of view, the mocked responses are indistinguishable from the real ones.

- :bulb: **Readability**

  `@zimic/interceptor` was designed to encourage clarity and readability in your mocks. Have
  [declarative assertions](/docs/zimic-interceptor/guides/7-declarative-assertions.md) to verify that your application
  is making the expected requests.

**Learn more**:

- [`@zimic/interceptor` - Getting started](/docs/zimic-interceptor/2-getting-started.mdx)
- [`@zimic/interceptor` - Guides](/docs/interceptor/guides)
- [`@zimic/interceptor` - API](/docs/interceptor/api)
- [`@zimic/interceptor` - CLI](/docs/interceptor/cli)
