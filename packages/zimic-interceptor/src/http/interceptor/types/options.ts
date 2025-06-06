import { PossiblePromise } from '@zimic/utils/types';

import { HttpInterceptorRequestSaving } from './public';
import { UnhandledHttpInterceptorRequest } from './requests';

/**
 * An type of an HTTP interceptor.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor `HttpInterceptor` API reference}
 */
export type HttpInterceptorType = 'local' | 'remote';

/**
 * The platform where an HTTP interceptor is running.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorplatform `interceptor.platform` API reference}
 */
export type HttpInterceptorPlatform = 'node' | 'browser';

/**
 * The strategy to treat unhandled requests.
 *
 * When `log` is `true` or `undefined`, warnings about unhandled requests are logged to the console. If provided a
 * factory, unhandled request warnings will be logged if the function returns a
 * {@link UnhandledRequestStrategy.Declaration strategy declaration} containing `log` as `true` or `undefined`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
 */
export namespace UnhandledRequestStrategy {
  /**
   * The action to take when an unhandled request is intercepted.
   *
   * In a {@link https://zimic.dev/docs/interceptor/guides/http/local-interceptors local interceptor}, the action is
   * always `bypass`, meaning that unhandled requests pass through the interceptor and reach the real network.
   * {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors Remote interceptors} always use `reject`,
   * since unhandled requests that react an {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}
   * cannot be bypassed.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  export type Action = 'bypass' | 'reject';

  /**
   * A static declaration of the strategy to use for unhandled requests.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
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
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  export type DeclarationFactory<DeclarationAction extends Action = Action> = (
    request: UnhandledHttpInterceptorRequest,
  ) => PossiblePromise<Declaration<DeclarationAction>>;

  /**
   * A static declaration of the strategy to use for unhandled requests in local interceptors.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  export type LocalDeclaration = Declaration;

  /**
   * A factory to create dynamic unhandled request strategies based on the intercepted request in local interceptors.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  export type LocalDeclarationFactory = DeclarationFactory;

  /**
   * A static declaration of the strategy to use for unhandled requests in remote interceptors.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  export type RemoteDeclaration = Declaration<'reject'>;

  /**
   * A factory to create dynamic unhandled request strategies based on the intercepted request in remote interceptors.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  export type RemoteDeclarationFactory = DeclarationFactory<'reject'>;

  /** The static declaration or a factory of the strategy to use for unhandled requests in local interceptors. */
  export type Local = LocalDeclaration | LocalDeclarationFactory;

  /** The static declaration or a factory of the strategy to use for unhandled requests in remote interceptors. */
  export type Remote = RemoteDeclaration | RemoteDeclarationFactory;
}

export type UnhandledRequestStrategy = UnhandledRequestStrategy.Local | UnhandledRequestStrategy.Remote;

export interface SharedHttpInterceptorOptions {
  /**
   * The type of the HTTP interceptor.
   *
   * @default 'local'
   */
  type?: HttpInterceptorType;

  /**
   * Represents the URL that should be matched by the interceptor. Any request starting with this base URL will be
   * intercepted if a matching {@link https://zimic.dev/docs/interceptor/api/http-request-handler handler} exists.
   *
   * For {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors remote interceptors}, this base URL
   * should point to an {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}. It may include
   * additional paths to differentiate between conflicting mocks.
   */
  baseURL: string;

  /**
   * Configures if the intercepted requests are saved and how they are handled.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#saving-requests Saving intercepted requests}
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/testing Testing}
   */
  requestSaving?: Partial<HttpInterceptorRequestSaving>;
}

/**
 * The options to create a
 * {@link https://zimic.dev/docs/interceptor/guides/http/local-interceptors local HTTP interceptor}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/local-interceptors#creating-a-local-http-interceptor Creating a local HTTP interceptor}
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference}
 */
export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type?: 'local';

  /**
   * The strategy to use for unhandled requests. If a request starts with the base URL of the interceptor, but no
   * matching handler exists, this strategy will be used. If a function is provided, it will be called with the
   * unhandled request.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy.Local;
}

/**
 * The options to create a
 * {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors remote HTTP interceptor}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#creating-a-remote-http-interceptor Creating a remote HTTP interceptor}
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference}
 */
export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';

  /**
   * Options to authenticate the interceptor when connecting to an interceptor server. This is required if the
   * interceptor server was started with the `--tokens-dir` option.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication Interceptor server authentication}
   */
  auth?: {
    /**
     * The authentication token to use.
     *
     * @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication Interceptor server authentication}
     */
    token: string;
  };

  /**
   * The strategy to use for unhandled requests. If a request starts with the base URL of the interceptor, but no
   * matching handler exists, this strategy will be used. If a function is provided, it will be called with the
   * unhandled request.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy.Remote;
}

/**
 * The options to create an {@link https://zimic.dev/docs/interceptor/api/http-interceptor HTTP interceptor}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference}
 */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
