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
} from 'zimic0';
import {
  createHttpInterceptorWorker,
  type HttpInterceptorWorker,
  type HttpInterceptorWorkerOptions,
  type HttpInterceptorWorkerPlatform,
  createHttpInterceptor,
  type HttpInterceptor,
  type HttpInterceptorOptions,
  type ExtractHttpInterceptorSchema,
  type HttpInterceptorRequest,
  type HttpInterceptorResponse,
  type TrackedHttpInterceptorRequest,
  type HttpRequestTracker,
  type HttpRequestTrackerResponseDeclaration,
  type HttpRequestTrackerResponseDeclarationFactory,
  NotStartedHttpInterceptorWorkerError,
  OtherHttpInterceptorWorkerRunningError,
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

    expectTypeOf(createHttpInterceptorWorker).not.toBeAny();
    expect(typeof createHttpInterceptorWorker).toBe('function');
    expectTypeOf<HttpInterceptorWorker>().not.toBeAny();
    expectTypeOf<HttpInterceptorWorkerOptions>().not.toBeAny();
    expectTypeOf<HttpInterceptorWorkerPlatform>().not.toBeAny();

    expectTypeOf(createHttpInterceptor).not.toBeAny();
    expect(typeof createHttpInterceptor).toBe('function');
    expectTypeOf<HttpInterceptor<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<ExtractHttpInterceptorSchema<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequest<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponse<never, never>>().not.toBeAny();
    expectTypeOf<TrackedHttpInterceptorRequest<never>>().not.toBeAny();

    expectTypeOf<HttpRequestTracker<never, never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseDeclaration<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseDeclarationFactory<never, never>>().not.toBeAny();

    expectTypeOf<NotStartedHttpInterceptorWorkerError>().not.toBeAny();
    expect(typeof NotStartedHttpInterceptorWorkerError).toBe('function');
    expectTypeOf<OtherHttpInterceptorWorkerRunningError>().not.toBeAny();
    expect(typeof OtherHttpInterceptorWorkerRunningError).toBe('function');
    expectTypeOf<UnregisteredServiceWorkerError>().not.toBeAny();
    expect(typeof UnregisteredServiceWorkerError).toBe('function');
  });
});
