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

A [WebSocket schema](/docs/ws/guides/schemas) declares the messages a connection can exchange. The client and the server use it to type every message sent and received, while following APIs you already know: [`WebSocketClient`](/docs/ws/api/websocket-client) mirrors the native [`WebSocket`](https://developer.mozilla.org/docs/Web/API/WebSocket), and [`WebSocketServer`](/docs/ws/api/websocket-server) mirrors the server of the [`ws`](https://github.com/websockets/ws) package.

## When to use

- Your application exchanges WebSocket messages and you want TypeScript to check them on both ends.
- You want a typed client that works in browsers and Node.js through the native WebSocket API.
- You want to mock WebSocket messages in development and tests with [`@zimic/interceptor`](/docs/interceptor/guides/ws/local-interceptors).

## Highlights

- :star: **WebSocket schemas**

  Declare the structure of the messages exchanged by your WebSocket connection in a [WebSocket schema](/docs/ws/guides/schemas) and use it to type client and server messages. Share the schema between both sides to keep them in sync.

- :zap: **Typed clients**

  Use [`WebSocketClient`](/docs/ws/api/websocket-client) to wrap a native `WebSocket` with typed lifecycle methods, listeners, and `send()` calls.

- :satellite: **Typed servers**

  Use [`WebSocketServer`](/docs/ws/api/websocket-server) to attach WebSocket handling to a Node HTTP or HTTPS server and receive typed connected clients.

**Learn more**:

- [`@zimic/ws` - Getting started](/docs/ws/getting-started)
- [`@zimic/ws` - Guides](/docs/ws/guides)
- [`@zimic/ws` - API](/docs/ws/api)
