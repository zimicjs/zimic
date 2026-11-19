<h1>
  Zimic + Vitest + Node.js + WebSocket
</h1>

This example uses Zimic with [Vitest](https://vitest.dev) and WebSockets in a server-side environment. [Node.js](https://nodejs.org) >= 22.4 is used in this example, but other runtimes with a native `WebSocket` should be similar, such as [Deno](https://deno.com) and [Bun](https://bun.sh).

> [!WARNING]
>
> WebSocket interceptors are experimental and available from `@zimic/interceptor/experimental/ws`. Their API may change before becoming stable. This example uses the `canary` versions of `@zimic/ws` and `@zimic/interceptor`.

- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Configuration](#configuration)
- [Try it](#try-it)
  - [StackBlitz](#stackblitz)
  - [CodeSandbox](#codesandbox)
  - [Cloning locally](#cloning-locally)
- [Running](#running)

## Testing

A `WebSocketClient` from `@zimic/ws` connects to the rooms of a chat service, whose connections and messages are mocked with `@zimic/interceptor`.

### `@zimic/interceptor`

- Chat WebSocket interceptor: [`tests/interceptors/chat.ts`](./tests/interceptors/chat.ts)

### Configuration

- Example test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Vitest configuration: [`vitest.config.mts`](./vitest.config.mts)

## Try it

### StackBlitz

<a href="https://stackblitz.com/github/zimicjs/zimic/tree/main/examples/zimic-with-vitest-node-websocket?file=README.md">
  <img
    src="https://developer.stackblitz.com/img/open_in_stackblitz.svg"
    alt="Open in StackBlitz"
    height="36px"
  />
</a>

### CodeSandbox

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/zimic-with-vitest-node-websocket">
  <img
    src="https://codesandbox.io/static/img/play-codesandbox.svg"
    alt="Edit in CodeSandbox"
    height="36px"
  />
</a>

### Cloning locally

```bash
mkdir zimic-tmp
cd zimic-tmp
git init
git remote add origin git@github.com:zimicjs/zimic.git
git sparse-checkout init
git sparse-checkout set examples/zimic-with-vitest-node-websocket
git pull origin main # or a specific branch or tag
mv examples/zimic-with-vitest-node-websocket ..
cd ../zimic-with-vitest-node-websocket
rm -rf ../zimic-tmp
```

> [!TIP]
>
> If you'd like to clone the example of a specific version, replace `main` with the desired branch or tag, such as `@zimic/interceptor@1.6.0-canary.9` and `@zimic/ws@0.2.0-canary.32`.

## Running

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Run the tests:

   ```bash
   pnpm run test
   ```
