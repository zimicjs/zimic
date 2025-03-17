import { typegen, type TypegenNamespace, type OpenAPITypegenOptions } from '@zimic/http/typegen';
import {
  createInterceptorServer,
  type InterceptorServer,
  type InterceptorServerOptions,
  RunningInterceptorServerError,
  NotRunningInterceptorServerError,
  DEFAULT_ACCESS_CONTROL_HEADERS,
  DEFAULT_PREFLIGHT_STATUS_CODE,
} from '@zimic/interceptor/server';
import { describe, expect, expectTypeOf, it } from 'vitest';

describe('Exports (Node.js)', () => {
  it('should export all expected resources', () => {
    expectTypeOf(createInterceptorServer).not.toBeAny();
    expect(typeof createInterceptorServer).toBe('function');

    expectTypeOf<InterceptorServer>().not.toBeAny();
    expectTypeOf<InterceptorServerOptions>().not.toBeAny();
    expectTypeOf<RunningInterceptorServerError>().not.toBeAny();
    expect(typeof RunningInterceptorServerError).toBe('function');
    expectTypeOf<NotRunningInterceptorServerError>().not.toBeAny();
    expect(typeof NotRunningInterceptorServerError).toBe('function');

    expect(DEFAULT_ACCESS_CONTROL_HEADERS).toEqual(expect.any(Object));
    expect(DEFAULT_PREFLIGHT_STATUS_CODE).toEqual(expect.any(Number));

    expectTypeOf<TypegenNamespace>().not.toBeAny();

    expectTypeOf(typegen.generateFromOpenAPI).toEqualTypeOf<TypegenNamespace['generateFromOpenAPI']>();
    expect(typeof typegen.generateFromOpenAPI).toBe('function');
    expectTypeOf<OpenAPITypegenOptions>().not.toBeAny();
  });
});
