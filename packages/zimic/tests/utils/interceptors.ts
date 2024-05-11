import { expect } from 'vitest';

import { HttpServiceSchema } from '@/http/types/schema';
import { createHttpInterceptor, HttpInterceptor } from '@/interceptor';
import HttpInterceptorStore from '@/interceptor/http/interceptor/HttpInterceptorStore';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import {
  HttpInterceptorOptions,
  HttpInterceptorType,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
} from '@/interceptor/http/interceptor/types/options';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '@/interceptor/http/interceptorWorker/types/options';
import Server from '@/server/Server';
import { PossiblePromise } from '@/types/utils';
import { getCrypto } from '@/utils/crypto';
import { createExtendedURL, ExtendedURL, joinURL } from '@/utils/fetch';
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
  options: HttpInterceptorOptions,
): LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
export function createInternalHttpInterceptor<Schema extends HttpServiceSchema>(options: HttpInterceptorOptions) {
  return createHttpInterceptor<Schema>(options) satisfies HttpInterceptor<Schema> as
    | LocalHttpInterceptor<Schema>
    | RemoteHttpInterceptor<Schema>;
}

type UsingInterceptorCallback<Schema extends HttpServiceSchema> = (
  interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>,
) => PossiblePromise<void>;

interface UsingInterceptorOptions {
  start?: boolean;
}

export async function usingHttpInterceptor<Schema extends HttpServiceSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callback: UsingInterceptorCallback<Schema>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpServiceSchema>(
  interceptorOptions: HttpInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingInterceptorCallback<Schema>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpServiceSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callbackOrOptions: UsingInterceptorCallback<Schema> | UsingInterceptorOptions,
  optionalCallback?: UsingInterceptorCallback<Schema>,
): Promise<void> {
  const { start: shouldStartInterceptor = true } = typeof callbackOrOptions === 'function' ? {} : callbackOrOptions;
  const callback = (optionalCallback ?? callbackOrOptions) as UsingInterceptorCallback<Schema>;

  const interceptor = createInternalHttpInterceptor<Schema>(interceptorOptions);

  try {
    if (shouldStartInterceptor) {
      await interceptor.start();
    }
    await callback(interceptor);
  } finally {
    await interceptor.stop();
  }
}

type UsingWorkerCallback = (worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker) => PossiblePromise<void>;

interface UsingWorkerOptions {
  start?: boolean;
}

export async function usingHttpInterceptorWorker(
  workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions,
  callback: UsingWorkerCallback,
): Promise<void>;
export async function usingHttpInterceptorWorker(
  workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions,
  options: UsingWorkerOptions,
  callback: UsingWorkerCallback,
): Promise<void>;
export async function usingHttpInterceptorWorker(
  workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions,
  callbackOrOptions: UsingWorkerCallback | UsingWorkerOptions,
  optionalCallback?: UsingWorkerCallback,
): Promise<void> {
  const { start: shouldStartWorker = true } = typeof callbackOrOptions === 'function' ? {} : callbackOrOptions;
  const callback = (optionalCallback ?? callbackOrOptions) as UsingWorkerCallback;

  const worker = createHttpInterceptorWorker(workerOptions);

  try {
    if (shouldStartWorker) {
      await worker.start();
    }
    await callback(worker);
  } finally {
    await worker.stop();
  }
}

export function getSingletonWorkerByType(
  store: HttpInterceptorStore,
  type: HttpInterceptorType,
  serverURL: ExtendedURL,
) {
  return type === 'local' ? store.localWorker() : store.remoteWorker(serverURL);
}
