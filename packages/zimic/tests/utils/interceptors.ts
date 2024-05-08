import { expect } from 'vitest';

import { HttpServiceSchema } from '@/http/types/schema';
import { createHttpInterceptor, HttpInterceptor } from '@/interceptor';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import {
  HttpInterceptorType,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
} from '@/interceptor/http/interceptor/types/options';
import Server from '@/server/Server';
import { PossiblePromise } from '@/types/utils';
import { getCrypto } from '@/utils/crypto';
import { createExtendedURL, joinURL } from '@/utils/fetch';
import { GLOBAL_SETUP_SERVER_HOSTNAME, GLOBAL_SETUP_SERVER_PORT } from '@tests/globalSetup/serverOnBrowser';

export async function getBrowserBaseURL(workerType: HttpInterceptorType) {
  if (workerType === 'local') {
    return createExtendedURL('http://localhost:3000');
  }

  const crypto = await getCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;
  const baseURL = joinURL(`http://${GLOBAL_SETUP_SERVER_HOSTNAME}:${GLOBAL_SETUP_SERVER_PORT}`, pathPrefix);
  return createExtendedURL(baseURL);
}

export async function getNodeBaseURL(type: HttpInterceptorType, server: Server) {
  if (type === 'local') {
    return createExtendedURL('http://localhost:3000');
  }

  const hostname = server.hostname();
  const port = server.port()!;
  expect(port).not.toBe(null);

  const crypto = await getCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;
  const baseURL = joinURL(`http://${hostname}:${port}`, pathPrefix);
  return createExtendedURL(baseURL);
}

export function createInternalHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions,
): LocalHttpInterceptor<Schema>;
export function createInternalHttpInterceptor<Schema extends HttpServiceSchema>(
  options: RemoteHttpInterceptorOptions,
): RemoteHttpInterceptor<Schema>;
export function createInternalHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions,
): LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
export function createInternalHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions,
) {
  return createHttpInterceptor<Schema>(options) satisfies HttpInterceptor<Schema> as
    | LocalHttpInterceptor<Schema>
    | RemoteHttpInterceptor<Schema>;
}

export async function usingHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions,
  callback: (interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>) => PossiblePromise<void>,
) {
  const interceptor = createInternalHttpInterceptor<Schema>(options);

  try {
    await interceptor.start();
    await callback(interceptor);
  } finally {
    await interceptor.stop();
  }
}
