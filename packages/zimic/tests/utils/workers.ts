import { expect } from 'vitest';

import Server from '@/cli/server/Server';
import { HttpInterceptorWorkerType } from '@/interceptor';
import { getCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/fetch';
import { GLOBAL_SETUP_SERVER_HOSTNAME, GLOBAL_SETUP_SERVER_PORT } from '@tests/globalSetup/serverOnBrowser';

export interface AccessResources {
  baseURL: string;
  pathPrefix: string;
}

export async function getBrowserAccessResources(workerType: HttpInterceptorWorkerType): Promise<AccessResources> {
  if (workerType === 'local') {
    return {
      baseURL: 'http://localhost:3000',
      pathPrefix: '',
    };
  }

  const crypto = await getCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;

  return {
    baseURL: joinURL(`http://${GLOBAL_SETUP_SERVER_HOSTNAME}:${GLOBAL_SETUP_SERVER_PORT}`, pathPrefix),
    pathPrefix,
  };
}

export async function getNodeAccessResources(
  type: HttpInterceptorWorkerType,
  server: Server,
): Promise<AccessResources> {
  if (type === 'local') {
    return {
      baseURL: 'http://localhost:3000',
      pathPrefix: '',
    };
  }

  const hostname = server.hostname();
  const port = server.port()!;
  expect(port).not.toBe(null);

  const crypto = await getCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;

  return {
    baseURL: joinURL(`http://${hostname}:${port}`, pathPrefix),
    pathPrefix,
  };
}
