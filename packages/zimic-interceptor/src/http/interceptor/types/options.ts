import { PossiblePromise } from '@zimic/utils/types';

import { HttpInterceptorRequestSaving } from './public';
import { UnhandledHttpInterceptorRequest } from './requests';

/** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptortype `interceptor.type` API reference} */
export type HttpInterceptorType = 'local' | 'remote';

/** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorplatform `interceptor.platform` API reference} */
export type HttpInterceptorPlatform = 'node' | 'browser';

/** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
export namespace UnhandledRequestStrategy {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type Action = 'bypass' | 'reject';

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export interface Declaration<DeclarationAction extends Action = Action> {
    /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
    action: DeclarationAction;

    /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
    log?: boolean;
  }

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type DeclarationFactory<DeclarationAction extends Action = Action> = (
    request: UnhandledHttpInterceptorRequest,
  ) => PossiblePromise<Declaration<DeclarationAction>>;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type LocalDeclaration = Declaration;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type LocalDeclarationFactory = DeclarationFactory;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type RemoteDeclaration = Declaration<'reject'>;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type RemoteDeclarationFactory = DeclarationFactory<'reject'>;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type Local = LocalDeclaration | LocalDeclarationFactory;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  export type Remote = RemoteDeclaration | RemoteDeclarationFactory;
}

export type UnhandledRequestStrategy = UnhandledRequestStrategy.Local | UnhandledRequestStrategy.Remote;

export interface SharedHttpInterceptorOptions {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference} */
  type?: HttpInterceptorType;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference} */
  baseURL: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference} */
  requestSaving?: Partial<HttpInterceptorRequestSaving>;
}

/**
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/local-interceptors#creating-a-local-http-interceptor Creating a local HTTP interceptor}
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference}
 */
export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type?: 'local';

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  onUnhandledRequest?: UnhandledRequestStrategy.Local;
}

interface HttpInterceptorAuthOptions {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication Interceptor server authentication} */
  token: string;
}

/**
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#creating-a-remote-http-interceptor Creating a remote HTTP interceptor}
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference}
 */
export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication Interceptor server authentication} */
  auth?: HttpInterceptorAuthOptions;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
  onUnhandledRequest?: UnhandledRequestStrategy.Remote;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference} */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
