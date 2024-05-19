import NotStartedHttpInterceptorError from './http/interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatform from './http/interceptor/errors/UnknownHttpInterceptorPlatform';
import { createHttpInterceptor } from './http/interceptor/factory';
import UnregisteredServiceWorkerError from './http/interceptorWorker/errors/UnregisteredServiceWorkerError';
import HttpInterceptorWorkerStore, {
  DefaultUnhandledRequestStrategy,
} from './http/interceptorWorker/HttpInterceptorWorkerStore';

export { UnknownHttpInterceptorPlatform, NotStartedHttpInterceptorError, UnregisteredServiceWorkerError };

export type {
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  TrackedHttpInterceptorRequest,
} from './http/requestHandler/types/requests';

export type {
  LocalHttpRequestHandler,
  RemoteHttpRequestHandler,
  SyncedRemoteHttpRequestHandler,
  PendingRemoteHttpRequestHandler,
  HttpRequestHandler,
} from './http/requestHandler/types/public';

export type {
  HttpInterceptorType,
  HttpInterceptorPlatform,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
  HttpInterceptorOptions,
} from './http/interceptor/types/options';
export type { ExtractHttpInterceptorSchema } from './http/interceptor/types/schema';

export type { LocalHttpInterceptor, RemoteHttpInterceptor, HttpInterceptor } from './http/interceptor/types/public';

export const http = Object.freeze({
  createInterceptor: createHttpInterceptor,

  default: {
    onUnhandledRequest(strategy: DefaultUnhandledRequestStrategy) {
      const store = new HttpInterceptorWorkerStore();
      store.setDefaultUnhandledRequestStrategy(strategy);
    },
  },
});

export type HttpNamespace = typeof http;
