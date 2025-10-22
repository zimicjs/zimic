import {
  HttpResponseSchemaStatusCode,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import HttpRequestHandlerClient from '../HttpRequestHandlerClient';
import {
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpRequestHandlerResponseDelayFactory,
  InterceptedHttpInterceptorRequest,
} from './requests';
import { HttpRequestHandlerRestriction } from './restrictions';

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
export interface HttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlermethod `handler.method` API reference}
   */
  get method(): Method;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerpath `handler.path` API reference}
   */
  get path(): Path;
}

export interface InternalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  client: HttpRequestHandlerClient<Schema, Method, Path, StatusCode>;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
export interface LocalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  /** @readonly */
  get type(): 'local';

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
  with: (restriction: HttpRequestHandlerRestriction<Schema, Method, Path>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((
    milliseconds: number | HttpRequestHandlerResponseDelayFactory<Path, Default<Schema[Path][Method]>>,
  ) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()` API reference} */
  respond: <NewStatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ) => LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfRequests: number) => this) & ((minNumberOfRequests: number, maxNumberOfRequests: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => void;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerclear `handler.clear()` API reference} */
  clear: () => this;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrequests `handler.requests` API reference}
   */
  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[];
}

/**
 * A synced remote HTTP request handler. When a remote handler is synced, it is guaranteed that all of the mocking
 * operations were committed to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export interface SyncedRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  /** @readonly */
  get type(): 'remote';

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
  with: (
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((
    milliseconds: number | HttpRequestHandlerResponseDelayFactory<Path, Default<Schema[Path][Method]>>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>) &
    ((
      minMilliseconds: number,
      maxMilliseconds: number,
    ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()` API reference} */
  respond: <NewStatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfRequests: number) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>) &
    ((
      minNumberOfRequests: number,
      maxNumberOfRequests: number,
    ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerclear `handler.clear()` API reference} */
  clear: () => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrequests `handler.requests` API reference}
   */
  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[];
}

/**
 * A pending remote HTTP request handler. When a remote handler is pending, it is not guaranteed that all of the mocking
 * operations were committed to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * To commit a remote interceptor, you can `await` it or use the methods {@link then handler.then()},
 * {@link catch handler.catch()}, and {@link finally handler.finally()}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export interface PendingRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  then: <FulfilledResult = SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>, RejectedResult = never>(
    onFulfilled?:
      | ((
          handler: SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>>;
}

/**
 * A remote HTTP request handler to declare responses for intercepted requests. In a remote handler, the mocking
 * operations are asynchronous and include remote calls to the connected
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptormethodpath `interceptor.<method>(path)`}
 * will be used.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export type RemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> = PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;
