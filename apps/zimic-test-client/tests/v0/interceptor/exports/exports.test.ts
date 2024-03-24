import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type JSONValue,
  type JSONCompatible,
  type JSONSerialized,
  type DefaultBody,
  type HttpRequest,
  type HttpResponse,
  HttpSearchParams,
  type HttpSearchParamsSchema,
  type HttpSearchParamsSchemaTuple,
  type HttpHeadersSchema,
  type HttpHeadersSchemaTuple,
  HttpHeaders,
  type HttpSchema,
  type HttpMethod,
  type HttpServiceMethodsSchema,
  type HttpServiceMethodSchema,
  type HttpServiceRequestSchema,
  type HttpServiceResponseSchema,
  type HttpServiceResponseSchemaByStatusCode,
  type HttpServiceResponseSchemaStatusCode,
  type HttpServiceSchema,
  type HttpServiceSchemaMethod,
  type HttpServiceSchemaPath,
  type LiteralHttpServiceSchemaPath,
  type NonLiteralHttpServiceSchemaPath,
} from 'zimic0';
import {
  createHttpInterceptor,
  createHttpInterceptorWorker,
  type HttpInterceptorWorker,
  type HttpInterceptor,
  type HttpInterceptorOptions,
  type HttpInterceptorRequest,
  type HttpInterceptorResponse,
  type HttpRequestTracker,
  type HttpRequestTrackerResponseDeclaration,
  type HttpRequestTrackerResponseDeclarationFactory,
  type TrackedHttpInterceptorRequest,
  type HttpInterceptorWorkerPlatform,
  type HttpInterceptorWorkerOptions,
  InvalidHttpInterceptorWorkerPlatform,
  MismatchedHttpInterceptorWorkerPlatform,
  NotStartedHttpInterceptorWorkerError,
  OtherHttpInterceptorWorkerRunningError,
  UnregisteredServiceWorkerError,
} from 'zimic0/interceptor';

describe('Exports', () => {
  it('should export all expected resources', () => {
    expectTypeOf(createHttpInterceptor).not.toBeAny();
    expect(typeof createHttpInterceptor).toBe('function');

    expectTypeOf(createHttpInterceptorWorker).not.toBeAny();
    expect(typeof createHttpInterceptorWorker).toBe('function');

    expectTypeOf<JSONValue>().not.toBeAny();
    expectTypeOf<JSONCompatible<never>>().not.toBeAny();
    expectTypeOf<JSONSerialized<never>>().not.toBeAny();

    expectTypeOf<DefaultBody>().not.toBeAny();
    expectTypeOf<HttpRequest>().not.toBeAny();
    expectTypeOf<HttpResponse>().not.toBeAny();
    expectTypeOf<HttpInterceptorWorker>().not.toBeAny();
    expectTypeOf<HttpInterceptorWorkerOptions>().not.toBeAny();
    expectTypeOf<HttpInterceptorWorkerPlatform>().not.toBeAny();

    expectTypeOf<HttpRequestTrackerResponseDeclaration<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseDeclarationFactory<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequest<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponse<never, never>>().not.toBeAny();
    expectTypeOf<TrackedHttpInterceptorRequest<never>>().not.toBeAny();
    expectTypeOf<HttpRequestTracker<never, never, never>>().not.toBeAny();

    expectTypeOf<HttpHeadersSchema>().not.toBeAny();
    expectTypeOf<HttpHeadersSchemaTuple<never>>().not.toBeAny();

    expectTypeOf<HttpHeaders>().not.toBeAny();
    expect(new HttpHeaders()).toBeInstanceOf(Headers);

    expectTypeOf<HttpSearchParamsSchema>().not.toBeAny();
    expectTypeOf<HttpSearchParamsSchemaTuple<never>>().not.toBeAny();

    expectTypeOf<HttpSearchParams>().not.toBeAny();
    expect(new HttpSearchParams()).toBeInstanceOf(URLSearchParams);

    expectTypeOf<HttpSchema.Paths<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Methods<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Method<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Request<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.ResponseByStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Response<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Headers<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.SearchParams<never>>().not.toBeAny();
    expectTypeOf<HttpSchema.Body<never>>().not.toBeAny();

    expectTypeOf<HttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<HttpMethod>().not.toBeAny();
    expectTypeOf<HttpServiceRequestSchema>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchema>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchemaByStatusCode>().not.toBeAny();
    expectTypeOf<HttpServiceResponseSchemaStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpServiceMethodsSchema>().not.toBeAny();
    expectTypeOf<HttpServiceMethodSchema>().not.toBeAny();

    expectTypeOf<HttpServiceSchema>().not.toBeAny();

    expectTypeOf<HttpServiceSchemaMethod<never>>().not.toBeAny();
    expectTypeOf<LiteralHttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<NonLiteralHttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpServiceSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptor<never>>().not.toBeAny();

    expectTypeOf<InvalidHttpInterceptorWorkerPlatform>().not.toBeAny();
    expect(typeof InvalidHttpInterceptorWorkerPlatform).toBe('function');
    expectTypeOf<MismatchedHttpInterceptorWorkerPlatform>().not.toBeAny();
    expect(typeof MismatchedHttpInterceptorWorkerPlatform).toBe('function');
    expectTypeOf<NotStartedHttpInterceptorWorkerError>().not.toBeAny();
    expect(typeof NotStartedHttpInterceptorWorkerError).toBe('function');
    expectTypeOf<OtherHttpInterceptorWorkerRunningError>().not.toBeAny();
    expect(typeof OtherHttpInterceptorWorkerRunningError).toBe('function');
    expectTypeOf<UnregisteredServiceWorkerError>().not.toBeAny();
    expect(typeof UnregisteredServiceWorkerError).toBe('function');
  });
});
