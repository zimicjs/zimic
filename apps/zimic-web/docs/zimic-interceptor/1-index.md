---
title: Introduction | @zimic/interceptor
sidebar_label: Introduction
slug: /interceptor
---

# Introduction

`@zimic/interceptor` is a type-safe interceptor library for handling and mocking HTTP requests in development and
testing.

:::info Status: <span>**Beta** :seedling:</span>

:::

## Features

- :globe_with_meridians: **HTTP interceptors**

  Use your [`@zimic/http` schema](/docs/zimic-http/guides/1-schemas.md) to declare
  [local](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md) and
  [remote](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md) HTTP interceptors. Mock external services
  and simulate success, loading, and error states with ease and type safety.

- :link: **Network-level interception**

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](/docs/zimic-interceptor/cli/1-server.md) to handle real HTTP requests. From your application's
  point of view, the mocked responses are indistinguishable from the real ones.

- :bulb: **Readability**

  `@zimic/interceptor` was designed to encourage clarity and readability. Declare intuitive mocks, test with confidence,
  and verify that your application is making the expected requests with
  [declarative assertions](/docs/zimic-interceptor/guides/http/7-declarative-assertions.mdx).

**Learn more**:

- [`@zimic/interceptor` - Getting started](/docs/zimic-interceptor/2-getting-started.mdx)
- [`@zimic/interceptor` - Guides](/docs/interceptor/guides)
- [`@zimic/interceptor` - API](/docs/interceptor/api)
- [`@zimic/interceptor` - CLI](/docs/interceptor/cli)
