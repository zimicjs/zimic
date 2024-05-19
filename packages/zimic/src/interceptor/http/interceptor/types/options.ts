import { HttpRequest } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

export type HttpInterceptorType = 'local' | 'remote';
export type HttpInterceptorPlatform = 'node' | 'browser';

export namespace UnhandledRequestStrategy {
  export type Declaration = Partial<{
    log: boolean;
  }>;

  export interface HandlerContext {
    log: () => Promise<void>;
  }
  export type Handler = (request: HttpRequest, context: HandlerContext) => PossiblePromise<void>;

  export type Action = 'bypass' | 'reject';
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type UnhandledRequestStrategy = UnhandledRequestStrategy.Declaration | UnhandledRequestStrategy.Handler;

interface SharedHttpInterceptorOptions {
  type: HttpInterceptorType;
  /** The base URL used by the interceptor. This URL will be prepended to any paths used by the interceptor. */
  baseURL: string | URL;
  onUnhandledRequest?: UnhandledRequestStrategy;
}

export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'local';
}

export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';
}

/** Options to create an HTTP interceptor. */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
