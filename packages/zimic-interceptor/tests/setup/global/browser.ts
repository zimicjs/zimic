import fs from 'fs';
import path from 'path';
import type { TestProject } from 'vitest/node';

import type { InterceptorServer } from '@/server';
import { createInterceptorServer } from '@/server/factory';
import { createInterceptorToken } from '@/server/utils/auth';

import { setup as sharedSetup, teardown as sharedTeardown } from './shared';

let interceptorServer: InterceptorServer | undefined;
let authenticatedInterceptorServer: InterceptorServer | undefined;

declare module 'vitest' {
  export interface ProvidedContext {
    interceptorServer: {
      url: string;
    };
    authenticatedInterceptorServer: {
      url: string;
      token: string;
    };
  }
}

const INTERCEPTOR_SERVER_HOSTNAME = 'localhost';

// We cannot start interceptor servers in browser environments, so we need to use a global setup script to start the
// server before the browser tests. The server will be reused across all of them.

export async function setup(project: TestProject) {
  await sharedSetup();

  interceptorServer = createInterceptorServer({
    hostname: INTERCEPTOR_SERVER_HOSTNAME,
    logUnhandledRequests: false,
  });

  await interceptorServer.start();

  project.provide('interceptorServer', {
    url: `http://${interceptorServer.hostname}:${interceptorServer.port}`,
  });

  authenticatedInterceptorServer = createInterceptorServer({
    hostname: INTERCEPTOR_SERVER_HOSTNAME,
    logUnhandledRequests: false,
    tokensDirectory: path.join(project.tmpDir, 'interceptor', 'server', 'tokens'),
  });

  await authenticatedInterceptorServer.start();

  const token = await createInterceptorToken({
    tokensDirectory: authenticatedInterceptorServer.tokensDirectory,
  });

  project.provide('authenticatedInterceptorServer', {
    url: `http://${authenticatedInterceptorServer.hostname}:${authenticatedInterceptorServer.port}`,
    token: token.value,
  });
}

export async function teardown() {
  await sharedTeardown();

  await Promise.all([interceptorServer?.stop(), authenticatedInterceptorServer?.stop()]);

  if (authenticatedInterceptorServer?.tokensDirectory) {
    await fs.promises.rm(authenticatedInterceptorServer.tokensDirectory, { force: true, recursive: true });
  }
}
