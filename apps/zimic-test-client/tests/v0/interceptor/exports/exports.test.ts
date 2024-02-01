import { describe, expect, expectTypeOf, it } from 'vitest';
import { JSONValue } from 'zimic0';
import {
  createHttpInterceptor,
  createHttpInterceptorWorker,
  HttpInterceptorWorker,
  type DefaultBody,
  type HttpInterceptor,
  type HttpInterceptorMethod,
  type HttpInterceptorMethodHandler,
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
  type HttpRequest,
  type HttpRequestTracker,
  type HttpRequestTrackerResponseAttribute,
  type HttpRequestTrackerResponseDeclaration,
  type HttpRequestTrackerResponseDeclarationFactory,
  type HttpResponse,
  type LiteralHttpInterceptorSchemaPath,
  type NonLiteralHttpInterceptorSchemaPath,
  type TrackedHttpInterceptorRequest,
  HttpInterceptorWorkerPlatform,
  HttpInterceptorWorkerOptions,
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

    expectTypeOf<HttpRequestTrackerResponseAttribute<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseDeclaration<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseDeclarationFactory<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequest<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponse<never, never>>().not.toBeAny();
    expectTypeOf<TrackedHttpInterceptorRequest<never>>().not.toBeAny();
    expectTypeOf<HttpRequestTracker<never, never, never>>().not.toBeAny();

    expectTypeOf<HttpInterceptorMethodHandler<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorOptions>().not.toBeAny();
    expectTypeOf<HttpInterceptorMethod>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequestSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponseSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponseSchemaByStatusCode>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponseSchemaStatusCode<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorMethodSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorPathSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchema>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchemaMethod<never>>().not.toBeAny();
    expectTypeOf<LiteralHttpInterceptorSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<NonLiteralHttpInterceptorSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorSchemaPath<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptor<never>>().not.toBeAny();
  });
});
