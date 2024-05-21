import type InterceptorServer from '@/interceptor/server/InterceptorServer';

let server: InterceptorServer | undefined;

export const GLOBAL_SETUP_SERVER_HOSTNAME = 'localhost';
export const GLOBAL_SETUP_SERVER_PORT = 3001;

export async function setup() {
  const Server = (await import('@/interceptor/server/InterceptorServer')).default;

  server = new Server({
    hostname: GLOBAL_SETUP_SERVER_HOSTNAME,
    port: GLOBAL_SETUP_SERVER_PORT,
  });

  await server.start();
}

export async function teardown() {
  await server?.stop();
}
