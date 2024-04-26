import { expect } from 'vitest';

import Server from '@/cli/server/Server';
import { HttpInterceptorWorkerType } from '@/interceptor';
import { getCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/fetch';
import { GLOBAL_SETUP_SERVER_HOSTNAME, GLOBAL_SETUP_SERVER_PORT } from '@tests/globalSetup/serverOnBrowser';

export interface AccessResources {
  serverURL: string;
  clientBaseURL: string;
  clientPathPrefix: string;
}

export async function getBrowserAccessResources(workerType: HttpInterceptorWorkerType): Promise<AccessResources> {
  if (workerType === 'local') {
    return {
      serverURL: '',
      clientBaseURL: 'http://localhost:3000',
      clientPathPrefix: '',
    };
  }

  const crypto = await getCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;

  const serverURL = `http://${GLOBAL_SETUP_SERVER_HOSTNAME}:${GLOBAL_SETUP_SERVER_PORT}`;

  return {
    serverURL,
    clientBaseURL: joinURL(serverURL, pathPrefix),
    clientPathPrefix: pathPrefix,
  };
}

export async function getNodeAccessResources(
  type: HttpInterceptorWorkerType,
  server: Server,
): Promise<AccessResources> {
  if (type === 'local') {
    return {
      serverURL: '',
      clientBaseURL: 'http://localhost:3000',
      clientPathPrefix: '',
    };
  }

  const hostname = server.hostname();
  const port = server.port()!;
  expect(port).not.toBe(null);

  const crypto = await getCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;

  const serverURL = `http://${hostname}:${port}`;
  return {
    serverURL,
    clientBaseURL: joinURL(serverURL, pathPrefix),
    clientPathPrefix: pathPrefix,
  };
}
