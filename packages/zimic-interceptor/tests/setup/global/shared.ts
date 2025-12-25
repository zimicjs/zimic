import { HttpHeaders } from '@zimic/http';
import { startHttpServer, stopHttpServer } from '@zimic/utils/server/lifecycle';
import type { Server } from 'http';

let fallbackServer: Server | undefined;

export const GLOBAL_FALLBACK_SERVER_HOSTNAME = 'localhost';
export const GLOBAL_FALLBACK_SERVER_PORT = Number(process.env.GLOBAL_FALLBACK_SERVER_PORT);

export const GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS = 200;

export const GLOBAL_FALLBACK_SERVER_HEADERS = {
  'cache-control': 'no-store',
  'global-fallback': 'true', // Custom header to identify responses from the fallback server.
};

// This server is used as a fallback in tests that check if unhandled requests are bypassed. When a request is bypassed,
// this server will handle it. If the request is rejected, it should not reach this server.
//
// By comparing the responses in the tests, we can use this to check if a request was correctly bypassed and reached the
// real network or was rejected before that.

export async function setup() {
  const [http, { DEFAULT_ACCESS_CONTROL_HEADERS }] = await Promise.all([import('http'), import('@/server')]);

  const headers = new HttpHeaders({
    ...DEFAULT_ACCESS_CONTROL_HEADERS,
    ...GLOBAL_FALLBACK_SERVER_HEADERS,
  });

  fallbackServer = http.createServer((_request, response) => {
    response.setHeaders(headers);
    response.statusCode = GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS;
    response.end();
  });

  await startHttpServer(fallbackServer, {
    hostname: GLOBAL_FALLBACK_SERVER_HOSTNAME,
    port: GLOBAL_FALLBACK_SERVER_PORT,
  });
}

export async function teardown() {
  if (fallbackServer) {
    await stopHttpServer(fallbackServer);
  }
}
