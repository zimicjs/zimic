import type { InterceptorServer } from '@/server';

import { setup as sharedSetup, teardown as sharedTeardown } from './shared';

let interceptorServer: InterceptorServer | undefined;

export const GLOBAL_INTERCEPTOR_SERVER_HOSTNAME = 'localhost';
export const GLOBAL_INTERCEPTOR_SERVER_PORT = 3001;

// We cannot start interceptor servers in browser environments, so we need to use a global setup script to start the
// server before the browser tests. The server will be reused across all browser tests.

export async function setup() {
  await sharedSetup();

  const { createInterceptorServer } = await import('@/server/factory');

  interceptorServer = createInterceptorServer({
    hostname: GLOBAL_INTERCEPTOR_SERVER_HOSTNAME,
    port: GLOBAL_INTERCEPTOR_SERVER_PORT,
    logUnhandledRequests: false,
  });

  await interceptorServer.start();
}

export async function teardown() {
  await sharedTeardown();

  await interceptorServer?.stop();
}
