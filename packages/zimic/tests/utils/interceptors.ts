import { HttpSchema, HttpMethod } from '@zimic/http';
import { expect } from 'vitest';

import { httpInterceptor } from '@/interceptor/http';
import HttpInterceptorStore from '@/interceptor/http/interceptor/HttpInterceptorStore';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import {
  HttpInterceptorOptions,
  HttpInterceptorPlatform,
  HttpInterceptorType,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
} from '@/interceptor/http/interceptor/types/options';
import { HttpInterceptor } from '@/interceptor/http/interceptor/types/public';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '@/interceptor/http/interceptorWorker/types/options';
import InterceptorServer from '@/interceptor/server/InterceptorServer';
import { PossiblePromise } from '@/types/utils';
import { importCrypto } from '@/utils/crypto';
import { createURL, ExtendedURL, joinURL } from '@/utils/urls';
import { GLOBAL_INTERCEPTOR_SERVER_HOSTNAME, GLOBAL_INTERCEPTOR_SERVER_PORT } from '@tests/setup/global/browser';
import { GLOBAL_FALLBACK_SERVER_PORT } from '@tests/setup/global/shared';

export async function getBrowserBaseURL(type: HttpInterceptorType) {
  if (type === 'local') {
    return createURL(`http://localhost:${GLOBAL_FALLBACK_SERVER_PORT}`);
  }

  const crypto = await importCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;
  const baseURL = joinURL(`http://${GLOBAL_INTERCEPTOR_SERVER_HOSTNAME}:${GLOBAL_INTERCEPTOR_SERVER_PORT}`, pathPrefix);
  return createURL(baseURL);
}

export async function getNodeBaseURL(type: HttpInterceptorType, server: InterceptorServer) {
  if (type === 'local') {
    return createURL(`http://localhost:${GLOBAL_FALLBACK_SERVER_PORT}`);
  }

  const hostname = server.hostname();
  const port = server.port()!;
  expect(port).not.toBe(null);

  const crypto = await importCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;
  const baseURL = joinURL(`http://${hostname}:${port}`, pathPrefix);
  return createURL(baseURL);
}

export function createInternalHttpInterceptor<Schema extends HttpSchema>(
  options: LocalHttpInterceptorOptions,
): LocalHttpInterceptor<HttpSchema<Schema>>;
export function createInternalHttpInterceptor<Schema extends HttpSchema>(
  options: RemoteHttpInterceptorOptions,
): RemoteHttpInterceptor<HttpSchema<Schema>>;
export function createInternalHttpInterceptor<Schema extends HttpSchema>(
  options: HttpInterceptorOptions,
): LocalHttpInterceptor<HttpSchema<Schema>> | RemoteHttpInterceptor<HttpSchema<Schema>>;
export function createInternalHttpInterceptor<Schema extends HttpSchema>(options: HttpInterceptorOptions) {
  return httpInterceptor.create<Schema>({
    saveRequests: true,
    ...options,
  }) satisfies HttpInterceptor<HttpSchema<Schema>> as
    | LocalHttpInterceptor<HttpSchema<Schema>>
    | RemoteHttpInterceptor<HttpSchema<Schema>>;
}

type UsingInterceptorCallback<Schema extends HttpSchema> = (
  interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>,
) => PossiblePromise<void>;

interface UsingInterceptorOptions {
  start?: boolean;
  checkTimes?: boolean;
}

export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callback: UsingInterceptorCallback<HttpSchema<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingInterceptorCallback<HttpSchema<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callbackOrOptions: UsingInterceptorCallback<HttpSchema<Schema>> | UsingInterceptorOptions,
  optionalCallback?: UsingInterceptorCallback<HttpSchema<Schema>>,
): Promise<void> {
  const { start: shouldStartInterceptor = true, checkTimes: shouldCheckTimes = false } =
    typeof callbackOrOptions === 'function' ? {} : callbackOrOptions;
  const callback = (optionalCallback ?? callbackOrOptions) as UsingInterceptorCallback<HttpSchema<Schema>>;

  const interceptor = createInternalHttpInterceptor<Schema>(interceptorOptions);

  try {
    if (shouldStartInterceptor) {
      await interceptor.start();
    }
    await callback(interceptor);

    if (shouldCheckTimes) {
      await interceptor.checkTimes();
    }
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

export function assessPreflightInterference(resources: {
  method: HttpMethod;
  platform: HttpInterceptorPlatform;
  type: HttpInterceptorType;
}) {
  const { method, platform, type } = resources;

  return {
    overridesPreflightResponse: method === 'OPTIONS' && type === 'remote',
    numberOfRequestsIncludingPreflight: method === 'OPTIONS' && platform === 'browser' && type === 'remote' ? 2 : 1,
  };
}
