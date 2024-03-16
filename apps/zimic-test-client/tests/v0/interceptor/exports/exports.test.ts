import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type JSONValue,
  type DefaultBody,
  type HttpRequest,
  type HttpResponse,
  HttpSearchParams,
  type HttpSearchParamsSchema,
  type HttpSearchParamsSchemaTuple,
  HttpHeadersSchema,
  HttpHeadersSchemaTuple,
  HttpHeaders,
} from 'zimic0';
import {
  createHttpInterceptor,
  createHttpInterceptorWorker,
  type HttpInterceptorWorker,
  type HttpInterceptor,
  type HttpInterceptorMethod,
  type HttpInterceptorMethodSchema,
  type HttpInterceptorOptions,
  type HttpInterceptorPathSchema,
  type HttpInterceptorRequest,
  type HttpInterceptorRequestSchema,
  type HttpInterceptorResponse,
  type HttpInterceptorResponseSchema,
  type HttpInterceptorResponseSchemaByStatusCode,
  type HttpInterceptorResponseSchemaStatusCode,
  type HttpInterceptorSchema,
  type HttpInterceptorSchemaMethod,
  type HttpInterceptorSchemaPath,
  type HttpRequestTracker,
  type HttpRequestTrackerResponseDeclaration,
  type HttpRequestTrackerResponseDeclarationFactory,
  type LiteralHttpInterceptorSchemaPath,
  type NonLiteralHttpInterceptorSchemaPath,
  type TrackedHttpInterceptorRequest,
  type HttpInterceptorWorkerPlatform,
  type HttpInterceptorWorkerOptions,
  type HttpInterceptorSearchParamsSchema,
  type HttpInterceptorBodySchema,
} from 'zimic0/interceptor';

describe('Exports', () => {
  it('should export all expected resources', () => {
    expectTypeOf(createHttpInterceptor).not.toBeAny();
    expect(typeof createHttpInterceptor).toBe('function');

    expectTypeOf(createHttpInterceptorWorker).not.toBeAny();
    expect(typeof createHttpInterceptorWorker).toBe('function');

    expectTypeOf<JSONValue>().not.toBeAny();
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

    expectTypeOf<HttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<HttpInterceptorMethod>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequestSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorSearchParamsSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorBodySchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponseSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponseSchemaByStatusCode>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponseSchemaStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorMethodSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorPathSchema>().not.toBeAny();

    expectTypeOf<HttpInterceptorSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.Root<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.Path<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.Method<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.Request<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.Response<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.ResponseByStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.Headers<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.SearchParams<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema.Body<never>>().not.toBeAny();

    expectTypeOf<HttpInterceptorSchemaMethod<never>>().not.toBeAny();
    expectTypeOf<LiteralHttpInterceptorSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<NonLiteralHttpInterceptorSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptor<never>>().not.toBeAny();
  });
});
