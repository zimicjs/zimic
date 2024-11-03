import type InterceptorServer from '@/interceptor/server/InterceptorServer';

let server: InterceptorServer | undefined;

export const GLOBAL_SETUP_SERVER_HOSTNAME = 'localhost';
export const GLOBAL_SETUP_SERVER_PORT = 3001;

export async function setup() {
  const { default: Server } = await import('@/interceptor/server/InterceptorServer');

  server = new Server({
    hostname: GLOBAL_SETUP_SERVER_HOSTNAME,
    port: GLOBAL_SETUP_SERVER_PORT,
    onUnhandledRequest: { log: false },
  });

  await server.start();
}

export async function teardown() {
  await server?.stop();
}
