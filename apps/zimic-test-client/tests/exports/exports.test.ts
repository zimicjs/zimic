import { describe, expect, expectTypeOf, it } from 'vitest';
import { type JSONValue, type JSONSerialized, InvalidJSONError } from 'zimic';
import {
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
  type HttpFormDataSerialized,
  type StrictFormData,
  type HttpSchema,
  type HttpMethod,
  type HttpStatusCode,
  type HttpServiceSchema,
  type HttpServiceMethodsSchema,
  type HttpMethodsSchema,
  type HttpServiceMethodSchema,
  type HttpMethodSchema,
  type HttpServiceRequestSchema,
  type HttpRequestSchema,
  type HttpServiceResponseSchemaByStatusCode,
  type HttpResponseSchemaByStatusCode,
  type HttpServiceResponseSchema,
  type HttpResponseSchema,
  type HttpServiceResponseSchemaStatusCode,
  type HttpResponseSchemaStatusCode,
  type HttpServiceSchemaMethod,
  type HttpSchemaMethod,
  type HttpServiceSchemaPath,
  type HttpSchemaPath,
  type LiteralHttpServiceSchemaPath,
  type NonLiteralHttpServiceSchemaPath,
  type PathParamsSchemaFromPath,
  type InferPathParams,
  type MergeHttpResponsesByStatusCode,
  InvalidFormDataError,
} from 'zimic/http';
import {
  httpInterceptor,
  type HttpInterceptorNamespace,
  type HttpInterceptorNamespaceDefault,
  type HttpInterceptor,
  type LocalHttpInterceptor,
  type RemoteHttpInterceptor,
  type HttpInterceptorPlatform,
  type HttpInterceptorType,
  type HttpInterceptorOptions,
  type LocalHttpInterceptorOptions,
  type RemoteHttpInterceptorOptions,
  type UnhandledRequestStrategy,
  type ExtractHttpInterceptorSchema,
  type InferHttpInterceptorSchema,
  type HttpInterceptorRequest,
  type HttpInterceptorResponse,
  type TrackedHttpInterceptorRequest,
  type HttpRequestHandler,
  type LocalHttpRequestHandler,
  type RemoteHttpRequestHandler,
  type SyncedRemoteHttpRequestHandler,
  type PendingRemoteHttpRequestHandler,
  type HttpRequestHandlerResponseDeclaration,
  type HttpRequestHandlerResponseDeclarationFactory,
  type HttpRequestHandlerRestriction,
  type HttpRequestHandlerComputedRestriction,
  type HttpRequestHandlerHeadersStaticRestriction,
  type HttpRequestHandlerSearchParamsStaticRestriction,
  type HttpRequestHandlerStaticRestriction,
  type HttpRequestHandlerBodyStaticRestriction,
  UnknownHttpInterceptorPlatformError,
  UnknownHttpInterceptorTypeError,
  NotStartedHttpInterceptorError,
  UnregisteredBrowserServiceWorkerError,
  DisabledRequestSavingError,
} from 'zimic/interceptor/http';

describe('Exports', () => {
  it('should export all expected resources', () => {
    expectTypeOf<JSONValue>().not.toBeAny();
    expectTypeOf<JSONValue<never>>().not.toBeAny();
    expectTypeOf<JSONSerialized<never>>().not.toBeAny();
    expectTypeOf<HttpHeadersSerialized<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSerialized<never>>().not.toBeAny();

    expectTypeOf<HttpBody>().not.toBeAny();
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
    expectTypeOf<HttpFormDataSerialized<never>>().not.toBeAny();
    expectTypeOf<StrictFormData<never>>().not.toBeAny();

    expectTypeOf<HttpSchema<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Paths<never>>().not.toBeAny();
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
    expectTypeOf<HttpServiceSchema>().not.toBeAny();
    expectTypeOf<HttpSchema>().not.toBeAny();
    expectTypeOf<HttpServiceMethodsSchema>().not.toBeAny();
    expectTypeOf<HttpMethodsSchema>().not.toBeAny();
    expectTypeOf<HttpServiceMethodSchema>().not.toBeAny();
    expectTypeOf<HttpMethodSchema>().not.toBeAny();
    expectTypeOf<HttpServiceRequestSchema>().not.toBeAny();
    expectTypeOf<HttpRequestSchema>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchemaByStatusCode>().not.toBeAny();
    expectTypeOf<HttpResponseSchemaByStatusCode>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchema>().not.toBeAny();
    expectTypeOf<HttpResponseSchema>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchemaStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpResponseSchemaStatusCode<never>>().not.toBeAny();

    expectTypeOf<HttpServiceSchemaMethod<never>>().not.toBeAny();
    expectTypeOf<HttpSchemaMethod<never>>().not.toBeAny();
    expectTypeOf<HttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<LiteralHttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpSchemaPath.Literal<never, never>>().not.toBeAny();
    expectTypeOf<NonLiteralHttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpSchemaPath.NonLiteral<never, never>>().not.toBeAny();
    expectTypeOf<PathParamsSchemaFromPath<never>>().not.toBeAny();
    expectTypeOf<InferPathParams<never>>().not.toBeAny();
    expectTypeOf<MergeHttpResponsesByStatusCode<never>>().not.toBeAny();

    expectTypeOf<InvalidJSONError>().not.toBeAny();
    expect(typeof InvalidJSONError).toBe('function');
    expectTypeOf<InvalidFormDataError>().not.toBeAny();
    expect(typeof InvalidFormDataError).toBe('function');

    expectTypeOf<HttpInterceptorNamespace>().not.toBeAny();
    expectTypeOf<HttpInterceptorNamespaceDefault>().not.toBeAny();

    expectTypeOf(httpInterceptor.create).toEqualTypeOf<HttpInterceptorNamespace['create']>();
    expect(typeof httpInterceptor.create).toBe('function');

    expectTypeOf(httpInterceptor.default).toEqualTypeOf<Readonly<HttpInterceptorNamespace['default']>>();
    expect(typeof httpInterceptor.default.local.onUnhandledRequest).toBe('object');
    expect(typeof httpInterceptor.default.remote.onUnhandledRequest).toBe('object');

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
    expectTypeOf<ExtractHttpInterceptorSchema<never>>().not.toBeAny();
    expectTypeOf<InferHttpInterceptorSchema<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequest<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponse<never, never>>().not.toBeAny();
    expectTypeOf<TrackedHttpInterceptorRequest<never, {}>>().not.toBeAny();

    expectTypeOf<HttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<LocalHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<RemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<SyncedRemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<PendingRemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerResponseDeclaration<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerResponseDeclarationFactory<never, never, never>>().not.toBeAny();

    expectTypeOf<HttpRequestHandlerRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerComputedRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerHeadersStaticRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerSearchParamsStaticRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerStaticRestriction<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerBodyStaticRestriction<never, never, never>>().not.toBeAny();

    expectTypeOf<UnknownHttpInterceptorPlatformError>().not.toBeAny();
    expect(typeof UnknownHttpInterceptorPlatformError).toBe('function');
    expectTypeOf<UnknownHttpInterceptorTypeError>().not.toBeAny();
    expect(typeof UnknownHttpInterceptorTypeError).toBe('function');
    expectTypeOf<NotStartedHttpInterceptorError>().not.toBeAny();
    expect(typeof NotStartedHttpInterceptorError).toBe('function');
    expectTypeOf<UnregisteredBrowserServiceWorkerError>().not.toBeAny();
    expect(typeof UnregisteredBrowserServiceWorkerError).toBe('function');
    expectTypeOf<DisabledRequestSavingError>().not.toBeAny();
    expect(typeof DisabledRequestSavingError).toBe('function');
  });
});
