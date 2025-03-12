# `@zimic/interceptor/server` - API reference <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`interceptorServer.create(options)`](#interceptorservercreateoptions)
- [CLI usage](#cli-usage)

---

`@zimic/interceptor/server` exports resources to manage interceptor servers programmatically. Even though we recommend
using the [`zimic-interceptor server` CLI](cli‐zimic‐server), this is still a valid alternative for more advanced use
cases.

## `interceptorServer.create(options)`

An example using the programmatic API and [`execa`](https://www.npmjs.com/package/execa) to run a command when the
server is ready:

```ts
import { execa as $ } from 'execa';
import { interceptorServer } from '@zimic/interceptor/server';

const server = interceptorServer.create({
  hostname: 'localhost',
  port: 3000,
});

await server.start();

// Run a command when the server is ready, assuming the following format:
// node <script> -- <command> [...commandArguments]
const [command, ...commandArguments] = process.argv.slice(3);
await $(command, commandArguments, { stdio: 'inherit' });

await server.stop();
process.exit(0);
```

The helper function `runCommand` is useful to run a shell command in server scripts. The
[Next.js App Router](../../examples/README.md#nextjs) and the [Playwright](../../examples/README.md#playwright) examples
use this function to run the application after the interceptor server is ready and all mocks are set up.

## CLI usage

See the [`zimic-interceptor server` CLI reference](cli‐zimic‐server).
