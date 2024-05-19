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
  export type LocalDeclarationFactory = (request: HttpRequest) => PossiblePromise<Partial<LocalDeclaration>>;
  export type Local = Partial<LocalDeclaration> | LocalDeclarationFactory;

  export interface RemoteDeclaration {
    action: Extract<Action, 'reject'>;
    log: boolean;
  }
  export type RemoteDeclarationFactory = (request: HttpRequest) => PossiblePromise<Partial<RemoteDeclaration>>;
  export type Remote = Partial<RemoteDeclaration> | RemoteDeclarationFactory;

  export type Declaration = LocalDeclaration | RemoteDeclaration;
  export type DeclarationFactory = LocalDeclarationFactory | RemoteDeclarationFactory;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type UnhandledRequestStrategy = UnhandledRequestStrategy.Local | UnhandledRequestStrategy.Remote;

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
