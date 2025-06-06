import { HttpSchema, HttpMethod } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import joinURL from '@zimic/utils/url/joinURL';
import { expect } from 'vitest';

import { createHttpInterceptor } from '@/http';
import LocalHttpInterceptor from '@/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/http/interceptor/RemoteHttpInterceptor';
import {
  HttpInterceptorOptions,
  HttpInterceptorPlatform,
  HttpInterceptorType,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
} from '@/http/interceptor/types/options';
import { HttpInterceptor } from '@/http/interceptor/types/public';
import { createHttpInterceptorWorker } from '@/http/interceptorWorker/factory';
import LocalHttpInterceptorWorker from '@/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '@/http/interceptorWorker/types/options';
import InterceptorServer from '@/server/InterceptorServer';
import { importCrypto } from '@/utils/crypto';
import { GLOBAL_INTERCEPTOR_SERVER_HOSTNAME, GLOBAL_INTERCEPTOR_SERVER_PORT } from '@tests/setup/global/browser';
import { GLOBAL_FALLBACK_SERVER_PORT } from '@tests/setup/global/shared';

export async function getBrowserBaseURL(type: HttpInterceptorType) {
  if (type === 'local') {
    return `http://localhost:${GLOBAL_FALLBACK_SERVER_PORT}`;
  }

  const crypto = await importCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;
  return joinURL(`http://${GLOBAL_INTERCEPTOR_SERVER_HOSTNAME}:${GLOBAL_INTERCEPTOR_SERVER_PORT}`, pathPrefix);
}

export async function getNodeBaseURL(type: HttpInterceptorType, server: InterceptorServer) {
  if (type === 'local') {
    return `http://localhost:${GLOBAL_FALLBACK_SERVER_PORT}`;
  }

  expect(server.port).not.toBe(null);

  const crypto = await importCrypto();
  const pathPrefix = `path-${crypto.randomUUID()}`;
  return joinURL(`http://${server.hostname}:${server.port}`, pathPrefix);
}

export function createInternalHttpInterceptor<Schema extends HttpSchema>(
  options: LocalHttpInterceptorOptions,
): LocalHttpInterceptor<Schema>;
export function createInternalHttpInterceptor<Schema extends HttpSchema>(
  options: RemoteHttpInterceptorOptions,
): RemoteHttpInterceptor<Schema>;
export function createInternalHttpInterceptor<Schema extends HttpSchema>(
  options: HttpInterceptorOptions,
): LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
export function createInternalHttpInterceptor<Schema extends HttpSchema>(options: HttpInterceptorOptions) {
  return createHttpInterceptor<Schema>({
    requestSaving: { enabled: true },
    onUnhandledRequest: { action: 'reject', log: false },
    ...options,
  }) satisfies HttpInterceptor<Schema> as LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
}

type UsingInterceptorCallback<Interceptor extends HttpInterceptor<never>> = (
  interceptor: Interceptor,
) => PossiblePromise<void>;

interface UsingInterceptorOptions {
  start?: boolean;
}

export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: LocalHttpInterceptorOptions,
  callback: UsingInterceptorCallback<LocalHttpInterceptor<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: LocalHttpInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingInterceptorCallback<LocalHttpInterceptor<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: RemoteHttpInterceptorOptions,
  callback: UsingInterceptorCallback<RemoteHttpInterceptor<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: RemoteHttpInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingInterceptorCallback<RemoteHttpInterceptor<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callback: UsingInterceptorCallback<LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingInterceptorCallback<LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>>,
): Promise<void>;
export async function usingHttpInterceptor<Schema extends HttpSchema>(
  interceptorOptions: HttpInterceptorOptions,
  callbackOrOptions:
    | UsingInterceptorCallback<LocalHttpInterceptor<Schema>>
    | UsingInterceptorCallback<RemoteHttpInterceptor<Schema>>
    | UsingInterceptorCallback<LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>>
    | UsingInterceptorOptions,
  optionalCallback?:
    | UsingInterceptorCallback<LocalHttpInterceptor<Schema>>
    | UsingInterceptorCallback<RemoteHttpInterceptor<Schema>>
    | UsingInterceptorCallback<LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>>,
): Promise<void> {
  const { start: shouldStartInterceptor = true } = typeof callbackOrOptions === 'function' ? {} : callbackOrOptions;
  const callback = (optionalCallback ?? callbackOrOptions) as UsingInterceptorCallback<
    LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>
  >;

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
