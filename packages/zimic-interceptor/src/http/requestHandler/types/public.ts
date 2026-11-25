import {
  HttpResponseSchemaStatusCode,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import HttpRequestHandlerImplementation from '../HttpRequestHandlerImplementation';
import {
  HttpRequestHandlerResponseDeclarationInput,
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
  implementation: HttpRequestHandlerImplementation<Schema, Method, Path, StatusCode>;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
export interface LocalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
   */
  get type(): 'local';

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwith `handler.with()` API reference} */
  with: (restriction: HttpRequestHandlerRestriction<Schema, Method, Path>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((
    milliseconds: number | HttpRequestHandlerResponseDelayFactory<Path, Default<Schema[Path][Method]>>,
  ) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()` API reference} */
  respond: <NewStatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration: HttpRequestHandlerResponseDeclarationInput<Path, Default<Schema[Path][Method]>, NewStatusCode>,
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

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
export interface SyncedRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
   */
  get type(): 'remote';

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwith `handler.with()` API reference} */
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
    declaration: HttpRequestHandlerResponseDeclarationInput<Path, Default<Schema[Path][Method]>, NewStatusCode>,
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

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
export interface PendingRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
  then: <FulfilledResult = SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>, RejectedResult = never>(
    onFulfilled?:
      | ((
          handler: SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> | RejectedResult>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>>;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference} */
export type RemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> = PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;
