import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  interceptorServer,
  type InterceptorServer,
  type InterceptorServerOptions,
  type InterceptorServerNamespace,
  NotStartedInterceptorServerError,
  DEFAULT_ACCESS_CONTROL_HEADERS,
  DEFAULT_PREFLIGHT_STATUS_CODE,
} from 'zimic0/interceptor/server';
import { typegen, type TypegenNamespace, type OpenAPITypegenOptions } from 'zimic0/typegen';

describe('Exports (Node.js)', () => {
  it('should export all expected resources', () => {
    expectTypeOf<InterceptorServerNamespace>().not.toBeAny();

    expectTypeOf(interceptorServer.create).toEqualTypeOf<InterceptorServerNamespace['create']>();
    expect(typeof interceptorServer.create).toBe('function');

    expectTypeOf<InterceptorServer>().not.toBeAny();
    expectTypeOf<InterceptorServerOptions>().not.toBeAny();
    expectTypeOf<NotStartedInterceptorServerError>().not.toBeAny();
    expect(typeof NotStartedInterceptorServerError).toBe('function');

    expect(DEFAULT_ACCESS_CONTROL_HEADERS).toEqual(expect.any(Object));
    expect(DEFAULT_PREFLIGHT_STATUS_CODE).toEqual(expect.any(Number));

    expectTypeOf<TypegenNamespace>().not.toBeAny();

    expectTypeOf(typegen.generateFromOpenAPI).toEqualTypeOf<TypegenNamespace['generateFromOpenAPI']>();
    expect(typeof typegen.generateFromOpenAPI).toBe('function');
    expectTypeOf<OpenAPITypegenOptions>().not.toBeAny();
  });
});
