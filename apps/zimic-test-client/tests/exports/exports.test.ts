import {
  createFetch,
  type Fetch,
  type FetchOptions,
  type InferFetchSchema,
  type FetchInput,
  type FetchRequestConstructor,
  type FetchRequest,
  type FetchRequestObject,
  type FetchRequestInit,
  type FetchResponse,
  type FetchResponsePerStatusCode,
  type FetchResponseObject,
  type JSONStringified,
  FetchResponseError,
  type FetchResponseErrorObject,
  type FetchResponseErrorObjectOptions,
} from '@zimic/fetch';
import {
  type JSONValue,
  type JSONSerialized,
  type HttpBody,
  type HttpRequest,
  type HttpResponse,
  type HttpPathParamsSchema,
  type HttpPathParamsSerialized,
  HttpHeaders,
  type HttpHeadersInit,
  type HttpHeadersSchema,
  type HttpHeadersSchemaTuple,
  type HttpHeadersSchemaName,
  type HttpHeadersSerialized,
  type StrictHeaders,
  HttpSearchParams,
  type HttpSearchParamsInit,
  type HttpSearchParamsSchema,
  type HttpSearchParamsSchemaTuple,
  type HttpSearchParamsSchemaName,
  type HttpSearchParamsSerialized,
  type StrictURLSearchParams,
  HttpFormData,
  type HttpFormDataSchema,
  type HttpFormDataSchemaName,
  type HttpFormDataSerialized,
  type StrictFormData,
  type HttpSchema,
  type HttpMethod,
  type HttpStatusCode,
  type HttpMethodsSchema,
  type HttpMethodSchema,
  type HttpRequestSchema,
  type HttpResponseSchemaByStatusCode,
  type HttpResponseSchema,
  type HttpResponseSchemaStatusCode,
  type HttpSchemaMethod,
  type HttpSchemaPath,
  type InferPathParams,
  type MergeHttpResponsesByStatusCode,
  parseHttpBody,
  InvalidFormDataError as HttpInvalidFormDataError,
  InvalidJSONError as HttpInvalidJSONError,
} from '@zimic/http';
import {
  createHttpInterceptor,
  type HttpInterceptor,
  type LocalHttpInterceptor,
  type RemoteHttpInterceptor,
  type HttpInterceptorPlatform,
  type HttpInterceptorType,
  type HttpInterceptorOptions,
  type LocalHttpInterceptorOptions,
  type RemoteHttpInterceptorOptions,
  type UnhandledRequestStrategy,
  type InferHttpInterceptorSchema,
  type HttpInterceptorRequest,
  type HttpInterceptorResponse,
  type InterceptedHttpInterceptorRequest,
  type UnhandledHttpInterceptorRequest,
  type HttpRequestHandler,
  type LocalHttpRequestHandler,
  type RemoteHttpRequestHandler,
  type SyncedRemoteHttpRequestHandler,
  type PendingRemoteHttpRequestHandler,
  type HttpRequestHandlerResponseDeclaration,
  type HttpRequestHandlerResponseDeclarationFactory,
  type HttpRequestHandlerResponseDelayFactory,
  type HttpRequestHandlerRestriction,
  type HttpRequestHandlerComputedRestriction,
  type HttpRequestHandlerHeadersStaticRestriction,
  type HttpRequestHandlerSearchParamsStaticRestriction,
  type HttpRequestHandlerStaticRestriction,
  type HttpRequestHandlerBodyStaticRestriction,
  RunningHttpInterceptorError,
  NotRunningHttpInterceptorError,
  UnknownHttpInterceptorPlatformError,
  UnknownHttpInterceptorTypeError,
  RequestSavingSafeLimitExceededError,
  InvalidFormDataError as InterceptorInvalidFormDataError,
  InvalidJSONError as InterceptorInvalidJSONError,
  UnregisteredBrowserServiceWorkerError,
  DisabledRequestSavingError,
  TimesCheckError,
} from '@zimic/interceptor/http';
import { describe, expect, expectTypeOf, it } from 'vitest';

describe('Exports', () => {
  it('should export all expected resources', () => {
    expectTypeOf<JSONValue>().not.toBeAny();
    expectTypeOf<JSONValue<never>>().not.toBeAny();
    expectTypeOf<JSONSerialized<never>>().not.toBeAny();
    expectTypeOf<HttpHeadersSerialized<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSerialized<never>>().not.toBeAny();

    expectTypeOf<HttpBody>().not.toBeAny();
    expectTypeOf<HttpBody.Loose>().not.toBeAny();
    expectTypeOf<HttpRequest>().not.toBeAny();
    expectTypeOf<HttpResponse>().not.toBeAny();

    expectTypeOf<HttpPathParamsSchema>().not.toBeAny();
    expectTypeOf<HttpPathParamsSerialized<never>>().not.toBeAny();

    expectTypeOf<HttpHeaders>().not.toBeAny();
    expect(new HttpHeaders()).toBeInstanceOf(Headers);
    expectTypeOf<HttpHeadersInit<never>>().not.toBeAny();
    expectTypeOf<HttpHeadersSchema>().not.toBeAny();
    expectTypeOf<HttpHeadersSchemaTuple<never>>().not.toBeAny();
    expectTypeOf<HttpHeadersSchemaName<never>>().not.toBeAny();
    expectTypeOf<HttpHeadersSerialized<never>>().not.toBeAny();
    expectTypeOf<StrictHeaders<never>>().not.toBeAny();

    expectTypeOf<HttpSearchParams>().not.toBeAny();
    expect(new HttpSearchParams()).toBeInstanceOf(URLSearchParams);
    expectTypeOf<HttpSearchParamsInit<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchema>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchemaTuple<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchemaName<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchemaName.Array<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchemaName.NonArray<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSerialized<never>>().not.toBeAny();
    expectTypeOf<StrictURLSearchParams<never>>().not.toBeAny();

    expectTypeOf<HttpFormData>().not.toBeAny();
    expect(new HttpFormData()).toBeInstanceOf(FormData);
    expectTypeOf<HttpFormDataSchema>().not.toBeAny();
    expectTypeOf<HttpFormDataSchemaName<never>>().not.toBeAny();
    expectTypeOf<HttpFormDataSerialized<never>>().not.toBeAny();
    expectTypeOf<StrictFormData<never>>().not.toBeAny();

    expectTypeOf<HttpSchema<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Methods<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Method<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Request<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.ResponseByStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Response<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Headers<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Body<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.SearchParams<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.PathParams<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.FormData<never>>().not.toBeAny();

    expectTypeOf<HttpMethod>().not.toBeAny();
    expectTypeOf<HttpStatusCode>().not.toBeAny();
    expectTypeOf<HttpStatusCode.Information>().not.toBeAny();
    expectTypeOf<HttpStatusCode.Success>().not.toBeAny();
    expectTypeOf<HttpStatusCode.Redirection>().not.toBeAny();
    expectTypeOf<HttpStatusCode.ClientError>().not.toBeAny();
    expectTypeOf<HttpStatusCode.ServerError>().not.toBeAny();
    expectTypeOf<HttpMethodsSchema>().not.toBeAny();
    expectTypeOf<HttpMethodSchema>().not.toBeAny();
    expectTypeOf<HttpRequestSchema>().not.toBeAny();
    expectTypeOf<HttpResponseSchemaByStatusCode>().not.toBeAny();
    expectTypeOf<HttpResponseSchema>().not.toBeAny();
    expectTypeOf<HttpResponseSchemaStatusCode<never>>().not.toBeAny();

    expectTypeOf<HttpSchemaMethod<never>>().not.toBeAny();
    expectTypeOf<HttpSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpSchemaPath.Literal<never, never>>().not.toBeAny();
    expectTypeOf<HttpSchemaPath.NonLiteral<never, never>>().not.toBeAny();
    expectTypeOf<InferPathParams<never>>().not.toBeAny();
    expectTypeOf<MergeHttpResponsesByStatusCode<never>>().not.toBeAny();

    expectTypeOf(parseHttpBody).not.toBeAny();
    expect(typeof parseHttpBody).toBe('function');

    expectTypeOf<HttpInvalidJSONError>().not.toBeAny();
    expect(typeof HttpInvalidJSONError).toBe('function');

    expectTypeOf<HttpInvalidFormDataError>().not.toBeAny();
    expect(typeof HttpInvalidFormDataError).toBe('function');

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expectTypeOf<InterceptorInvalidJSONError>().not.toBeAny();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(typeof InterceptorInvalidJSONError).toBe('function');

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expectTypeOf<InterceptorInvalidFormDataError>().not.toBeAny();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(typeof InterceptorInvalidFormDataError).toBe('function');

    expect(typeof createFetch).toBe('function');
    expectTypeOf<Fetch<never>>().not.toBeAny();
    expectTypeOf<Fetch.Loose>().not.toBeAny();
    expectTypeOf<FetchOptions<never>>().not.toBeAny();
    expectTypeOf<InferFetchSchema<never>>().not.toBeAny();
    expectTypeOf<FetchInput<never, never, never>>().not.toBeAny();
    expectTypeOf<FetchRequest<never, never, never>>().not.toBeAny();
    expectTypeOf<FetchRequestObject>().not.toBeAny();
    expectTypeOf<FetchRequestConstructor<never>>().not.toBeAny();
    expectTypeOf<FetchRequestInit<never, never, never>>().not.toBeAny();
    expectTypeOf<FetchResponse<never, never, never>>().not.toBeAny();
    expectTypeOf<FetchResponsePerStatusCode<never, never, never, never>>().not.toBeAny();
    expectTypeOf<FetchResponseObject>().not.toBeAny();
    expectTypeOf<FetchResponseError<never, never, never>>().not.toBeAny();
    expect(typeof FetchResponseError).toBe('function');
    expectTypeOf<FetchResponseErrorObject>().not.toBeAny();
    expectTypeOf<FetchResponseErrorObjectOptions>().not.toBeAny();
    expectTypeOf<FetchResponseErrorObjectOptions.WithBody>().not.toBeAny();
    expectTypeOf<FetchResponseErrorObjectOptions.WithoutBody>().not.toBeAny();
    expectTypeOf<JSONStringified<never>>().not.toBeAny();

    expectTypeOf(createHttpInterceptor).not.toBeAny();
    expect(typeof createHttpInterceptor).toBe('function');

    expectTypeOf<UnhandledRequestStrategy>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.Action>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.Declaration>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.DeclarationFactory>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.Local>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.LocalDeclaration>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.LocalDeclarationFactory>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.Remote>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.RemoteDeclaration>().not.toBeAny();
    expectTypeOf<UnhandledRequestStrategy.RemoteDeclarationFactory>().not.toBeAny();

    expectTypeOf<HttpInterceptor<never>>().not.toBeAny();
    expectTypeOf<LocalHttpInterceptor<never>>().not.toBeAny();
    expectTypeOf<RemoteHttpInterceptor<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorPlatform>().not.toBeAny();
    expectTypeOf<HttpInterceptorType>().not.toBeAny();
    expectTypeOf<HttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<LocalHttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<RemoteHttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<InferHttpInterceptorSchema<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequest<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponse<never, never>>().not.toBeAny();
    expectTypeOf<InterceptedHttpInterceptorRequest<never, never>>().not.toBeAny();
    expectTypeOf<UnhandledHttpInterceptorRequest>().not.toBeAny();

    expectTypeOf<HttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<LocalHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<RemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<SyncedRemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<PendingRemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerResponseDeclaration<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerResponseDeclarationFactory<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerResponseDelayFactory<never, never>>().not.toBeAny();

    expectTypeOf<HttpRequestHandlerRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerComputedRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerHeadersStaticRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerSearchParamsStaticRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerStaticRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerBodyStaticRestriction<never, never, never>>().not.toBeAny();

    expectTypeOf<RunningHttpInterceptorError>().not.toBeAny();
    expect(typeof RunningHttpInterceptorError).toBe('function');

    expectTypeOf<NotRunningHttpInterceptorError>().not.toBeAny();
    expect(typeof NotRunningHttpInterceptorError).toBe('function');

    expectTypeOf<UnknownHttpInterceptorPlatformError>().not.toBeAny();
    expect(typeof UnknownHttpInterceptorPlatformError).toBe('function');

    expectTypeOf<UnknownHttpInterceptorTypeError>().not.toBeAny();
    expect(typeof UnknownHttpInterceptorTypeError).toBe('function');

    expectTypeOf<RequestSavingSafeLimitExceededError>().not.toBeAny();
    expect(typeof RequestSavingSafeLimitExceededError).toBe('function');

    expectTypeOf<UnregisteredBrowserServiceWorkerError>().not.toBeAny();
    expect(typeof UnregisteredBrowserServiceWorkerError).toBe('function');

    expectTypeOf<DisabledRequestSavingError>().not.toBeAny();
    expect(typeof DisabledRequestSavingError).toBe('function');

    expectTypeOf<TimesCheckError>().not.toBeAny();
    expect(typeof TimesCheckError).toBe('function');
  });
});
