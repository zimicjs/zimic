import { type OpenAPITypegenOptions, generateTypesFromOpenAPI } from '@zimic/http/typegen';
import {
  createInterceptorServer,
  type InterceptorServer,
  type InterceptorServerOptions,
  RunningInterceptorServerError,
  NotRunningInterceptorServerError,
  DEFAULT_ACCESS_CONTROL_HEADERS,
  DEFAULT_PREFLIGHT_STATUS_CODE,
} from '@zimic/interceptor/server';
import { WebSocketServer, type WebSocketServerOptions } from '@zimic/ws/server';
import { describe, expect, expectTypeOf, it } from 'vitest';

describe('Exports (Node.js)', () => {
  it('exports all expected resources from @zimic/http', () => {
    expectTypeOf(generateTypesFromOpenAPI).not.toBeAny();
    expect(typeof generateTypesFromOpenAPI).toBe('function');

    expectTypeOf<OpenAPITypegenOptions>().not.toBeAny();
  });

  it('exports all expected resources from @zimic/ws', () => {
    expectTypeOf<WebSocketServer>().not.toBeAny();
    expect(typeof WebSocketServer).toBe('function');

    expectTypeOf<WebSocketServerOptions>().not.toBeAny();
  });

  it('exports all expected resources from @zimic/interceptor', () => {
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
  });
});
