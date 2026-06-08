<p align="center">
  <img src="../../docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  @zimic/ws
</h1>

<p align="center">
  Next-gen TypeScript-first WebSocket client and server
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zimic/ws">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://zimic.dev">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://zimic.dev/docs/examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/4">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)

[![NPM Downloads - @zimic/ws](https://img.shields.io/npm/dm/@zimic/ws?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Fws&labelColor=353C43)](https://www.npmjs.com/package/@zimic/ws)&nbsp;
[![Bundle size - @zimic/ws](https://badgen.net/bundlephobia/minzip/@zimic/ws?color=0E69BE&labelColor=353C43&label=@zimic/ws%20min%20gzip)](https://bundlephobia.com/package/@zimic/ws)<br />

</div>

---

`@zimic/ws` is a minimal and type-safe WebSocket client and server.

> [!NOTE]
>
> Status: 🚧 Alpha

## Highlights

- :star: **WebSocket schemas**

  Declare the messages exchanged by your WebSocket connection in a `WebSocketSchema` and use it to type clients,
  servers, and WebSocket interceptors.

- :zap: **Typed clients**

  Use `WebSocketClient` to wrap native WebSocket connections with typed lifecycle methods, listeners, and `send()`
  calls.

- :satellite: **Typed servers**

  Use `WebSocketServer` to attach typed WebSocket handling to an existing Node HTTP or HTTPS server.

## Getting started

```ts
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<
  { type: 'message'; data: { text: string } } | { type: 'typing'; data: { username: string } }
>;

const client = new WebSocketClient<Schema>('ws://localhost:3000/chat');

await client.open();
client.send(JSON.stringify({ type: 'message', data: { text: 'Hello!' } }));
await client.close();
```

In Node.js, use the server entry point:

```ts
import { createServer } from 'node:http';
import { WebSocketSchema } from '@zimic/ws';
import { WebSocketServer } from '@zimic/ws/server';

type Schema = WebSocketSchema<
  { type: 'message'; data: { text: string } } | { type: 'typing'; data: { username: string } }
>;

const httpServer = createServer();
const webSocketServer = new WebSocketServer<Schema>({ httpServer });

webSocketServer.addEventListener('connection', (client) => {
  client.addEventListener('message', (event) => {
    client.send(event.data);
  });
});

httpServer.listen(3000, '127.0.0.1');
await webSocketServer.open();
```

**Learn more**:

- [`@zimic/ws` - Introduction](https://zimic.dev/docs/ws)
- [`@zimic/ws` - Getting started](https://zimic.dev/docs/ws/getting-started)
- [`@zimic/ws` - Schemas](https://zimic.dev/docs/ws/guides/schemas)
- [`@zimic/ws` - API](https://zimic.dev/docs/ws/api)
