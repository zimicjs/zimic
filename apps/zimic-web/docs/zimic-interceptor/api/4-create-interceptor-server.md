---
title: createInterceptorServer | @zimic/interceptor
sidebar_label: createInterceptorServer
slug: /interceptor/api/create-interceptor-server
---

# `createInterceptorServer`

Creates an [interceptor server](/docs/zimic-interceptor/api/5-interceptor-server.md) for development or testing. This function is an alternative to the [`zimic-interceptor server` CLI command](/docs/zimic-interceptor/cli/1-server.md) and can be used to programmatically manage an interceptor server in your code. We recommend using the CLI command for most use cases, but `createInterceptorServer` is useful for more advanced scenarios.

```ts
createInterceptorServer(options);
```

**Arguments**:

1. **options**: `InterceptorServerOptions`

   The options to create an [interceptor server](/docs/zimic-interceptor/cli/1-server.md).
   - **hostname**: `string | undefined` (default: `'localhost'`)

     The hostname to start the server on.

   - **port**: `number | undefined`

     The port to start the server on. If no port is provided, a random one is chosen.

   - **logUnhandledRequests**: `boolean | undefined` (default: `true`)

     Whether to log warnings about unhandled requests to the console.

   - **tokensDirectory**: `string | undefined` (default: `undefined`)

     The directory where the authorized interceptor authentication tokens are saved.

     Although this option is optional for private development servers, we strongly recommend configuring [interceptor server authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication) when the server is not bound to `localhost`, `127.0.0.1`, or `::1`, or when it is shared over a network. Every remote interceptor must then provide a valid token through [`auth.token`](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx), which prevents unauthorized interceptors from connecting to the server.

     Without a tokens directory, browser remote interceptors can connect only when both the server and the web application use a loopback hostname. Starting an unauthenticated server logs a warning when it uses a non-loopback hostname or runs with `NODE_ENV=production`. See [interceptor server authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication) for details.

     In `@zimic/interceptor` v2, an unauthenticated server will refuse to start on a non-loopback hostname.

**Returns**: `InterceptorServer`

An [interceptor server](/docs/zimic-interceptor/api/5-interceptor-server.md) which can be used to connect [remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md).

```ts
import { spawn, SpawnOptions } from 'child_process';
import { createInterceptorServer } from '@zimic/interceptor/server';

async function runCommand(commandEntry: string, commandArguments: string[], options: SpawnOptions) {
  await new Promise<void>((resolve, reject) => {
    const commandProcess = spawn(commandEntry, commandArguments, options);

    commandProcess.once('error', (error) => {
      reject(error);
    });

    commandProcess.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command '${commandEntry}' exited with code ${code}`));
      }
    });
  });
}

// highlight-start
const server = createInterceptorServer({
  hostname: 'localhost',
  port: 3000,
});
// highlight-end

await server.start();

// Run a command when the server is ready, assuming the following format:
// node <script> -- <command> [...commandArguments]
const [commandEntry, ...commandArguments] = process.argv.slice(3);
await runCommand(commandEntry, commandArguments, { stdio: 'inherit' });

await server.stop();
process.exit(0);
```

**Related**:

- [Using remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md)
- [`zimic-interceptor server` CLI reference](/docs/zimic-interceptor/cli/1-server.md)
- [`InterceptorServer` API reference](/docs/zimic-interceptor/api/5-interceptor-server.md)
