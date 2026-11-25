---
title: Introduction | @zimic/ws
sidebar_label: Introduction
slug: /ws
---

# Introduction

`@zimic/ws` is a minimal and type-safe WebSocket client and server.

:::note ALPHA

`@zimic/ws` is in alpha. Its API may change before becoming stable.

:::

A [WebSocket schema](/docs/zimic-ws/guides/1-schemas.md) declares the messages a connection can exchange. The client and the server use it to type every message sent and received, while following APIs you already know: [`WebSocketClient`](/docs/zimic-ws/api/2-websocket-client.mdx) mirrors the native [`WebSocket`](https://developer.mozilla.org/docs/Web/API/WebSocket), and [`WebSocketServer`](/docs/zimic-ws/api/3-websocket-server.mdx) mirrors the server of the [`ws`](https://github.com/websockets/ws) package.

## When to use

- Your application exchanges WebSocket messages and you want TypeScript to check them on both ends.
- You want a typed client that works in browsers and Node.js through the native WebSocket API.
- You want to mock WebSocket messages in development and tests with [`@zimic/interceptor`](/docs/zimic-interceptor/guides/ws/1-local-websocket-interceptors.md).

## Highlights

- :star: **WebSocket schemas**

  Declare the structure of the messages exchanged by your WebSocket connection in a [WebSocket schema](/docs/zimic-ws/guides/1-schemas.md) and use it to type client and server messages. Share the schema between both sides to keep them in sync.

- :zap: **Typed clients**

  Use [`WebSocketClient`](/docs/zimic-ws/api/2-websocket-client.mdx) to wrap a native `WebSocket` with typed lifecycle methods, listeners, and `send()` calls.

- :satellite: **Typed servers**

  Use [`WebSocketServer`](/docs/zimic-ws/api/3-websocket-server.mdx) to attach WebSocket handling to a Node HTTP or HTTPS server and receive typed connected clients.

**Learn more**:

- [`@zimic/ws` - Getting started](/docs/zimic-ws/2-getting-started.mdx)
- [`@zimic/ws` - Guides](/docs/ws/guides)
- [`@zimic/ws` - API](/docs/ws/api)
