import { PossiblePromise } from '@zimic/utils/types';

import { UnhandledHttpInterceptorRequest } from './requests';

/**
 * An type of an HTTP interceptor.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor` API reference}
 */
export type HttpInterceptorType = 'local' | 'remote';

/**
 * The platform where an HTTP interceptor is running.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorplatform `interceptor.platform` API reference}
 */
export type HttpInterceptorPlatform = 'node' | 'browser';

/**
 * The strategy to treat unhandled requests.
 *
 * When `log` is `true` or `undefined`, warnings about unhandled requests are logged to the console. If provided a
 * factory, unhandled request warnings will be logged if the function returns a
 * {@link UnhandledRequestStrategy.Declaration strategy declaration} containing `log` as `true` or `undefined`.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
 */
export namespace UnhandledRequestStrategy {
  /**
   * The action to take when an unhandled request is intercepted.
   *
   * In a {@link https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors local interceptor}, the
   * action is always `bypass`, meaning that unhandled requests pass through the interceptor and reach the real network.
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors Remote interceptors} always use
   * `reject`, since unhandled requests that react an
   * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server} cannot be bypassed.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export type Action = 'bypass' | 'reject';

  /**
   * A static declaration of the strategy to use for unhandled requests.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export interface Declaration<DeclarationAction extends Action = Action> {
    /** The action to take when an unhandled request is intercepted. */
    action: DeclarationAction;

    /**
     * Whether to log unhandled requests to the console.
     *
     * @default true
     */
    log?: boolean;
  }

  /**
   * A factory to create dynamic unhandled request strategies based on the intercepted request.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export type DeclarationFactory<DeclarationAction extends Action = Action> = (
    request: UnhandledHttpInterceptorRequest,
  ) => PossiblePromise<Declaration<DeclarationAction>>;

  /**
   * A static declaration of the strategy to use for unhandled requests in local interceptors.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export type LocalDeclaration = Declaration;

  /**
   * A factory to create dynamic unhandled request strategies based on the intercepted request in local interceptors.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export type LocalDeclarationFactory = DeclarationFactory;

  /**
   * A static declaration of the strategy to use for unhandled requests in remote interceptors.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export type RemoteDeclaration = Declaration<'reject'>;

  /**
   * A factory to create dynamic unhandled request strategies based on the intercepted request in remote interceptors.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export type RemoteDeclarationFactory = DeclarationFactory<'reject'>;

  /** The static declaration or a factory of the strategy to use for unhandled requests in local interceptors. */
  export type Local = LocalDeclaration | LocalDeclarationFactory;

  /** The static declaration or a factory of the strategy to use for unhandled requests in remote interceptors. */
  export type Remote = RemoteDeclaration | RemoteDeclarationFactory;
}

export type UnhandledRequestStrategy = UnhandledRequestStrategy.Local | UnhandledRequestStrategy.Remote;

export interface SharedHttpInterceptorOptions {
  /** The type of the HTTP interceptor. */
  type: HttpInterceptorType;

  /**
   * Represents the URL that should be matched by the interceptor. Any request starting with this base URL will be
   * intercepted if a matching
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler handler} exists.
   *
   * For {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptors}, this
   * base URL should point to an
   * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}. It may include
   * additional paths to differentiate between conflicting mocks.
   */
  baseURL: string;

  /**
   * Whether {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler request handlers}
   * should save their intercepted requests in memory and make them accessible through
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrequests `handler.requests`}.
   *
   * **Important**: If `saveRequests` is true, make sure to regularly clear the interceptor to avoid that the requests
   * accumulate in memory. A common practice is to call
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear `interceptor.clear()`}
   * after each test.
   *
   * @default false
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#saving-requests Saving intercepted requests}
   * @see {@link https://github.com/zimicjs/zimic/wiki/guides‐testing‐interceptor Testing}
   */
  saveRequests?: boolean;
}

/**
 * The options to create a
 * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors local HTTP interceptor}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#creating-a-local-http-interceptor Creating a local HTTP interceptor}
 */
export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'local';

  /**
   * The strategy to use for unhandled requests. If a request starts with the base URL of the interceptor, but no
   * matching handler exists, this strategy will be used. If a function is provided, it will be called with the
   * unhandled request.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy.Local;
}

/**
 * The options to create a
 * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote HTTP interceptor}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#creating-a-remote-http-interceptor Creating a remote HTTP interceptor}
 */
export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';

  /**
   * The strategy to use for unhandled requests. If a request starts with the base URL of the interceptor, but no
   * matching handler exists, this strategy will be used. If a function is provided, it will be called with the
   * unhandled request.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy.Remote;
}

/**
 * The options to create an
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor HTTP interceptor}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#createhttpinterceptoroptions `createHttpInterceptor(options)` API reference}
 */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
