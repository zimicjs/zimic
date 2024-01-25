import { describe, expectTypeOf, it } from 'vitest';
import type {
  DefaultBody,
  HttpInterceptor,
  HttpInterceptorMethod,
  HttpInterceptorMethodHandler,
  HttpInterceptorMethodSchema,
  HttpInterceptorOptions,
  HttpInterceptorPathSchema,
  HttpInterceptorRequest,
  HttpInterceptorRequestSchema,
  HttpInterceptorResponse,
  HttpInterceptorResponseSchema,
  HttpInterceptorResponseSchemaByStatusCode,
  HttpInterceptorResponseSchemaStatusCode,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
  HttpRequest,
  HttpRequestTracker,
  HttpRequestTrackerResponseAttribute,
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  HttpResponse,
  LiteralHttpInterceptorSchemaPath,
  NonLiteralHttpInterceptorSchemaPath,
  TrackedHttpInterceptorRequest,
} from 'zimic0/interceptor';

describe('Exports', () => {
  it('should export all expected types', () => {
    expectTypeOf<DefaultBody>().not.toBeAny();
    expectTypeOf<HttpRequest>().not.toBeAny();
    expectTypeOf<HttpResponse>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseAttribute<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseDeclaration<never, never>>().not.toBeAny();
    expectTypeOf<HttpRequestTrackerResponseDeclarationFactory<never, never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorRequest<never>>().not.toBeAny();
    expectTypeOf<HttpInterceptorResponse<never, never>>().not.toBeAny();
    expectTypeOf<TrackedHttpInterceptorRequest<never>>().not.toBeAny();
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
    expectTypeOf<HttpRequestTracker<never>>().not.toBeAny();
  });
});
