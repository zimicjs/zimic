import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type JSONValue,
  type JSONSerialized,
  type HttpBody,
  type HttpRequest,
  type HttpResponse,
  HttpSearchParams,
  type HttpSearchParamsInit,
  type HttpSearchParamsSchema,
  type HttpSearchParamsSchemaTuple,
  type StrictURLSearchParams,
  HttpHeaders,
  type HttpHeadersInit,
  type HttpHeadersSchema,
  type HttpHeadersSchemaTuple,
  type StrictHeaders,
  type HttpSchema,
  type HttpMethod,
  type HttpServiceSchema,
  type HttpServiceMethodsSchema,
  type HttpServiceMethodSchema,
  type HttpServiceRequestSchema,
  type HttpServiceResponseSchemaByStatusCode,
  type HttpServiceResponseSchema,
  type HttpServiceResponseSchemaStatusCode,
  type HttpServiceSchemaMethod,
  type HttpServiceSchemaPath,
  type LiteralHttpServiceSchemaPath,
  type NonLiteralHttpServiceSchemaPath,
  InvalidURL,
} from 'zimic0';
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
  type ExtractHttpInterceptorSchema,
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
  UnknownHttpInterceptorPlatform,
  NotStartedHttpInterceptorError,
  UnregisteredServiceWorkerError,
} from 'zimic0/interceptor';

describe('Exports', () => {
  it('should export all expected resources', () => {
    expectTypeOf<JSONValue>().not.toBeAny();
    expectTypeOf<JSONValue<never>>().not.toBeAny();
    expectTypeOf<JSONSerialized<never>>().not.toBeAny();

    expectTypeOf<HttpBody>().not.toBeAny();
    expectTypeOf<HttpRequest>().not.toBeAny();
    expectTypeOf<HttpResponse>().not.toBeAny();

    expectTypeOf<HttpSearchParams>().not.toBeAny();
    expect(new HttpSearchParams()).toBeInstanceOf(URLSearchParams);
    expectTypeOf<HttpSearchParamsInit<never>>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchema>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchemaTuple<never>>().not.toBeAny();
    expectTypeOf<StrictURLSearchParams<never>>().not.toBeAny();

    expectTypeOf<HttpHeaders>().not.toBeAny();
    expect(new HttpHeaders()).toBeInstanceOf(Headers);
    expectTypeOf<HttpHeadersInit<never>>().not.toBeAny();
    expectTypeOf<HttpHeadersSchema>().not.toBeAny();
    expectTypeOf<HttpHeadersSchemaTuple<never>>().not.toBeAny();
    expectTypeOf<StrictHeaders<never>>().not.toBeAny();

    expectTypeOf<HttpSchema.Paths<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Methods<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Method<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Request<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.ResponseByStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Response<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Headers<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.SearchParams<never>>().not.toBeAny();

    expectTypeOf<HttpMethod>().not.toBeAny();
    expectTypeOf<HttpServiceSchema>().not.toBeAny();
    expectTypeOf<HttpServiceMethodsSchema>().not.toBeAny();
    expectTypeOf<HttpServiceMethodSchema>().not.toBeAny();
    expectTypeOf<HttpServiceRequestSchema>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchemaByStatusCode>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchema>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchemaStatusCode<never>>().not.toBeAny();

    expectTypeOf<HttpServiceSchemaMethod<never>>().not.toBeAny();
    expectTypeOf<HttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<LiteralHttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<NonLiteralHttpServiceSchemaPath<never, never>>().not.toBeAny();

    expectTypeOf<InvalidURL>().not.toBeAny();
    expect(typeof InvalidURL).toBe('function');

    expectTypeOf(createHttpInterceptor).not.toBeAny();
    expect(typeof createHttpInterceptor).toBe('function');
    expectTypeOf<HttpInterceptor<never>>().not.toBeAny();
    expectTypeOf<LocalHttpInterceptor<never>>().not.toBeAny();
    expectTypeOf<RemoteHttpInterceptor<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorPlatform>().not.toBeAny();
    expectTypeOf<HttpInterceptorType>().not.toBeAny();
    expectTypeOf<HttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<LocalHttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<RemoteHttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<ExtractHttpInterceptorSchema<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequest<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponse<never, never>>().not.toBeAny();
    expectTypeOf<TrackedHttpInterceptorRequest<never>>().not.toBeAny();

    expectTypeOf<HttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<LocalHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<RemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<SyncedRemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<PendingRemoteHttpRequestHandler<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerResponseDeclaration<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestHandlerResponseDeclarationFactory<never, never>>().not.toBeAny();

    expectTypeOf<UnknownHttpInterceptorPlatform>().not.toBeAny();
    expect(typeof UnknownHttpInterceptorPlatform).toBe('function');
    expectTypeOf<NotStartedHttpInterceptorError>().not.toBeAny();
    expect(typeof NotStartedHttpInterceptorError).toBe('function');
    expectTypeOf<UnregisteredServiceWorkerError>().not.toBeAny();
    expect(typeof UnregisteredServiceWorkerError).toBe('function');
  });
});
