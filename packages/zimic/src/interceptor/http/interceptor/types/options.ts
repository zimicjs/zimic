import { HttpRequest } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

export type HttpInterceptorType = 'local' | 'remote';
export type HttpInterceptorPlatform = 'node' | 'browser';

interface SharedHttpInterceptorOptions {
  type: HttpInterceptorType;
  /** The base URL used by the interceptor. This URL will be prepended to any paths used by the interceptor. */
  baseURL: string | URL;
}

export namespace UnhandledRequestStrategy {
  export type Action = 'bypass' | 'reject';

  export interface LocalDeclaration {
    action: Action;
    log: boolean;
  }
  export type LocalDeclarationHandler = (request: HttpRequest) => PossiblePromise<Required<LocalDeclaration>>;

  export interface RemoteDeclaration {
    action: Extract<Action, 'reject'>;
    log: boolean;
  }
  export type RemoteDeclarationHandler = (request: HttpRequest) => PossiblePromise<Required<RemoteDeclaration>>;
}

export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'local';
  onUnhandledRequest?:
    | Partial<UnhandledRequestStrategy.LocalDeclaration>
    | UnhandledRequestStrategy.LocalDeclarationHandler;
}

export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';
}

/** Options to create an HTTP interceptor. */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
