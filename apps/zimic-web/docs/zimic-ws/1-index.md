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

## Highlights

- :star: **WebSocket schemas**

  Declare the structure of the messages exchanged by your WebSocket connection in a
  [WebSocket schema](/docs/zimic-ws/guides/1-schemas.md) and use it to type client and server messages.

- :zap: **Typed clients**

  Use [`WebSocketClient`](/docs/zimic-ws/api/2-websocket-client.mdx) to wrap a native `WebSocket` with typed lifecycle
  methods, listeners, and `send()` calls.

- :satellite: **Typed servers**

  Use [`WebSocketServer`](/docs/zimic-ws/api/3-websocket-server.mdx) to attach WebSocket handling to a Node HTTP or
  HTTPS server and receive typed connected clients.

**Learn more**:

- [`@zimic/ws` - Getting started](/docs/ws/getting-started)
- [`@zimic/ws` - Guides](/docs/ws/guides)
- [`@zimic/ws` - API](/docs/ws/api)
