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
  export type LocalDeclarationFactory = (request: HttpRequest) => PossiblePromise<Required<LocalDeclaration>>;
  export type Local = Partial<LocalDeclaration> | LocalDeclarationFactory;

  export interface RemoteDeclaration {
    action: Extract<Action, 'reject'>;
    log: boolean;
  }
  export type RemoteDeclarationFactory = (request: HttpRequest) => PossiblePromise<Required<RemoteDeclaration>>;
  export type Remote = Partial<RemoteDeclaration> | RemoteDeclarationFactory;

  export type Any = Local | Remote;
}

export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'local';
  onUnhandledRequest?: UnhandledRequestStrategy.Local;
}

export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';
  onUnhandledRequest?: UnhandledRequestStrategy.Remote;
}

/** Options to create an HTTP interceptor. */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
