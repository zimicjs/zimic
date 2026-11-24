---
title: Introduction | @zimic/interceptor
sidebar_label: Introduction
slug: /interceptor
---

# Introduction

`@zimic/interceptor` is a type-safe interceptor library for handling and mocking HTTP requests and WebSocket messages in development and testing.

## Highlights

- :globe_with_meridians: **Typed interceptors**

  Use your [`@zimic/http`](/docs/zimic-http/guides/1-schemas.md) and [`@zimic/ws`](/docs/zimic-ws/guides/1-schemas.md) schemas to declare [HTTP](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md) and [WebSocket](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md) interceptors that run locally or through an [interceptor server](/docs/zimic-interceptor/cli/1-server.md). Mock external services and simulate success, loading, and error states with type safety. WebSocket support is experimental.

- :link: **Network-level interception**

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and [interceptor servers](/docs/zimic-interceptor/cli/1-server.md) to handle real HTTP requests and WebSocket connections. From your application's point of view, the mocked responses and messages are indistinguishable from the real ones.

- :bulb: **Readability**

  `@zimic/interceptor` was designed to encourage clarity and readability. Verify that your application makes the expected requests and sends the expected messages with declarative assertions for [HTTP](/docs/zimic-interceptor/guides/http/7-declarative-assertions.mdx) and [WebSocket](/docs/zimic-interceptor/guides/ws/5-declarative-assertions.mdx).

**Learn more**:

- [`@zimic/interceptor` - Getting started](/docs/zimic-interceptor/2-getting-started.mdx)
- [`@zimic/interceptor` - Guides](/docs/interceptor/guides)
- [`@zimic/interceptor` - API](/docs/interceptor/api)
- [`@zimic/interceptor` - CLI](/docs/interceptor/cli)
