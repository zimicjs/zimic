import { HttpSchema, HttpMethod } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import { joinURL } from '@zimic/utils/url';
import { WebSocketSchema } from '@zimic/ws';
import { expect, inject } from 'vitest';

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
import { createWebSocketInterceptor } from '@/ws/interceptor/factory';
import LocalWebSocketInterceptor from '@/ws/interceptor/LocalWebSocketInterceptor';
import RemoteWebSocketInterceptor from '@/ws/interceptor/RemoteWebSocketInterceptor';
import {
  LocalWebSocketInterceptorOptions,
  RemoteWebSocketInterceptorOptions,
  WebSocketInterceptorOptions,
} from '@/ws/interceptor/types/options';
import {
  LocalWebSocketInterceptor as PublicLocalWebSocketInterceptor,
  RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor,
  WebSocketInterceptor,
} from '@/ws/interceptor/types/public';
import { createWebSocketInterceptorWorker } from '@/ws/interceptorWorker/factory';
import LocalWebSocketInterceptorWorker from '@/ws/interceptorWorker/LocalWebSocketInterceptorWorker';
import RemoteWebSocketInterceptorWorker from '@/ws/interceptorWorker/RemoteWebSocketInterceptorWorker';
import {
  LocalWebSocketInterceptorWorkerOptions,
  RemoteWebSocketInterceptorWorkerOptions,
} from '@/ws/interceptorWorker/types/options';

export function getBrowserBaseURL(type: HttpInterceptorType) {
  if (type === 'local') {
    return inject('fallbackServer').url;
  }

  const pathPrefix = `path-${crypto.randomUUID()}`;
  return joinURL(inject('interceptorServer').url, pathPrefix);
}

export function getNodeBaseURL(type: HttpInterceptorType, server: InterceptorServer) {
  if (type === 'local') {
    return inject('fallbackServer').url;
  }

  expect(server.port).not.toBe(null);

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

export function createInternalWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: LocalWebSocketInterceptorOptions,
): LocalWebSocketInterceptor<Schema>;
export function createInternalWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: RemoteWebSocketInterceptorOptions,
): RemoteWebSocketInterceptor<Schema>;
export function createInternalWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: WebSocketInterceptorOptions,
): LocalWebSocketInterceptor<Schema> | RemoteWebSocketInterceptor<Schema>;
export function createInternalWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: WebSocketInterceptorOptions,
) {
  return createWebSocketInterceptor<Schema>({
    messageSaving: { enabled: false },
    ...options,
  }) satisfies WebSocketInterceptor<Schema> as LocalWebSocketInterceptor<Schema> | RemoteWebSocketInterceptor<Schema>;
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

type UsingWebSocketInterceptorCallback<Interceptor> = (interceptor: Interceptor) => PossiblePromise<void>;

export async function usingWebSocketInterceptor<Schema extends WebSocketSchema>(
  interceptorOptions: LocalWebSocketInterceptorOptions,
  callback: UsingWebSocketInterceptorCallback<PublicLocalWebSocketInterceptor<Schema>>,
): Promise<void>;
export async function usingWebSocketInterceptor<Schema extends WebSocketSchema>(
  interceptorOptions: LocalWebSocketInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingWebSocketInterceptorCallback<PublicLocalWebSocketInterceptor<Schema>>,
): Promise<void>;
export async function usingWebSocketInterceptor<Schema extends WebSocketSchema>(
  interceptorOptions: RemoteWebSocketInterceptorOptions,
  callback: UsingWebSocketInterceptorCallback<PublicRemoteWebSocketInterceptor<Schema>>,
): Promise<void>;
export async function usingWebSocketInterceptor<Schema extends WebSocketSchema>(
  interceptorOptions: RemoteWebSocketInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingWebSocketInterceptorCallback<PublicRemoteWebSocketInterceptor<Schema>>,
): Promise<void>;
export async function usingWebSocketInterceptor<Schema extends WebSocketSchema>(
  interceptorOptions: WebSocketInterceptorOptions,
  callback: UsingWebSocketInterceptorCallback<
    PublicLocalWebSocketInterceptor<Schema> | PublicRemoteWebSocketInterceptor<Schema>
  >,
): Promise<void>;
export async function usingWebSocketInterceptor<Schema extends WebSocketSchema>(
  interceptorOptions: WebSocketInterceptorOptions,
  options: UsingInterceptorOptions,
  callback: UsingWebSocketInterceptorCallback<
    PublicLocalWebSocketInterceptor<Schema> | PublicRemoteWebSocketInterceptor<Schema>
  >,
): Promise<void>;
export async function usingWebSocketInterceptor<Schema extends WebSocketSchema>(
  interceptorOptions: WebSocketInterceptorOptions,
  callbackOrOptions:
    | UsingWebSocketInterceptorCallback<PublicLocalWebSocketInterceptor<Schema>>
    | UsingWebSocketInterceptorCallback<PublicRemoteWebSocketInterceptor<Schema>>
    | UsingWebSocketInterceptorCallback<
        PublicLocalWebSocketInterceptor<Schema> | PublicRemoteWebSocketInterceptor<Schema>
      >
    | UsingInterceptorOptions,
  optionalCallback?:
    | UsingWebSocketInterceptorCallback<PublicLocalWebSocketInterceptor<Schema>>
    | UsingWebSocketInterceptorCallback<PublicRemoteWebSocketInterceptor<Schema>>
    | UsingWebSocketInterceptorCallback<
        PublicLocalWebSocketInterceptor<Schema> | PublicRemoteWebSocketInterceptor<Schema>
      >,
): Promise<void> {
  const { start: shouldStartInterceptor = true } = typeof callbackOrOptions === 'function' ? {} : callbackOrOptions;
  const runCallback = (optionalCallback ?? callbackOrOptions) as UsingWebSocketInterceptorCallback<
    PublicLocalWebSocketInterceptor<Schema> | PublicRemoteWebSocketInterceptor<Schema>
  >;

  const interceptor = createInternalWebSocketInterceptor<Schema>(interceptorOptions);

  try {
    if (shouldStartInterceptor) {
      await interceptor.start();
    }
    await runCallback(interceptor);
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

type UsingWebSocketInterceptorWorkerCallback = (
  worker: LocalWebSocketInterceptorWorker | RemoteWebSocketInterceptorWorker,
) => PossiblePromise<void>;

export async function usingWebSocketInterceptorWorker(
  workerOptions: LocalWebSocketInterceptorWorkerOptions | RemoteWebSocketInterceptorWorkerOptions,
  callback: UsingWebSocketInterceptorWorkerCallback,
): Promise<void>;
export async function usingWebSocketInterceptorWorker(
  workerOptions: LocalWebSocketInterceptorWorkerOptions | RemoteWebSocketInterceptorWorkerOptions,
  options: UsingWorkerOptions,
  callback: UsingWebSocketInterceptorWorkerCallback,
): Promise<void>;
export async function usingWebSocketInterceptorWorker(
  workerOptions: LocalWebSocketInterceptorWorkerOptions | RemoteWebSocketInterceptorWorkerOptions,
  callbackOrOptions: UsingWebSocketInterceptorWorkerCallback | UsingWorkerOptions,
  optionalCallback?: UsingWebSocketInterceptorWorkerCallback,
): Promise<void> {
  const { start: shouldStartWorker = true } = typeof callbackOrOptions === 'function' ? {} : callbackOrOptions;
  const callback = (optionalCallback ?? callbackOrOptions) as UsingWebSocketInterceptorWorkerCallback;

  const worker = createWebSocketInterceptorWorker(workerOptions);

  try {
    if (shouldStartWorker) {
      await worker.start();
    }
    await callback(worker);
  } finally {
    await worker.stop();
  }
}

export function getPreflightAssessment(resources: {
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
