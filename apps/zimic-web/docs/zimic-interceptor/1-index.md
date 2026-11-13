---
title: Introduction | @zimic/interceptor
sidebar_label: Introduction
slug: /interceptor
---

# Introduction

`@zimic/interceptor` is a type-safe interceptor library for handling and mocking HTTP requests and WebSocket messages in development and testing.

Interceptors use the schema of your API to type your mocks: an [HTTP schema](/docs/zimic-http/guides/1-schemas.md) from [`@zimic/http`](/docs/zimic-http/1-index.md) for HTTP interceptors, and a [WebSocket schema](/docs/ws/guides/schemas) from [`@zimic/ws`](/docs/ws) for WebSocket interceptors. You only need the schema package of the protocol you mock. Interception happens at the network level, so it works with any client, including the native `fetch`, [`@zimic/fetch`](/docs/zimic-fetch/1-index.md), and [axios](https://axios-http.com).

## When to use

- You test code that calls an external API and want mocks that match the real API.
- You develop against a backend that is unavailable or not ready yet.
- You want your tests to verify which requests and messages your application sends.
- You run end-to-end tests where the application and the tests are separate processes.

## Highlights

- :globe_with_meridians: **HTTP interceptors**

  Use your [`@zimic/http` schema](/docs/zimic-http/guides/1-schemas.md) to declare [local](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md) and [remote](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md) HTTP interceptors. Mock external services and simulate success, loading, and error states with ease and type safety.

- :zap: **WebSocket interceptors**

  Use your [`@zimic/ws` schema](/docs/ws/guides/schemas) to declare [experimental WebSocket interceptors](/docs/interceptor/guides/ws/local-interceptors). Mock typed message flows, observe connected clients, send server messages, and verify expected messages in development and tests.

- :link: **Network-level interception**

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and [interceptor servers](/docs/zimic-interceptor/cli/1-server.md) to handle real HTTP requests and WebSocket connections. From your application's point of view, the mocked responses and messages are indistinguishable from the real ones.

- :bulb: **Readability**

  `@zimic/interceptor` was designed to encourage clarity and readability. Declare intuitive mocks, test with confidence, and verify that your application is making the expected requests with [declarative assertions](/docs/zimic-interceptor/guides/http/7-declarative-assertions.mdx).

**Learn more**:

- [`@zimic/interceptor` - Getting started](/docs/interceptor/getting-started)
- [`@zimic/interceptor` - Guides](/docs/interceptor/guides)
- [`@zimic/interceptor` - API](/docs/interceptor/api)
- [`@zimic/interceptor` - CLI](/docs/interceptor/cli)
