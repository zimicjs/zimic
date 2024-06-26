import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createInterceptorServer,
  InterceptorServer,
  InterceptorServerOptions,
  NotStartedInterceptorServerError,
  runCommand,
  CommandError,
  DEFAULT_ACCESS_CONTROL_HEADERS,
  DEFAULT_PREFLIGHT_STATUS_CODE,
} from 'zimic0/server';

describe('Exports (Node.js)', () => {
  it('should export all expected resources', () => {
    expect(typeof createInterceptorServer).toBe('function');
    expectTypeOf<InterceptorServer>().not.toBeAny();
    expectTypeOf<InterceptorServerOptions>().not.toBeAny();
    expectTypeOf<NotStartedInterceptorServerError>().not.toBeAny();
    expect(typeof NotStartedInterceptorServerError).toBe('function');
    expect(typeof runCommand).toBe('function');
    expectTypeOf<CommandError>().not.toBeAny();
    expect(typeof CommandError).toBe('function');

    expect(DEFAULT_ACCESS_CONTROL_HEADERS).toEqual(expect.any(Object));
    expect(DEFAULT_PREFLIGHT_STATUS_CODE).toEqual(expect.any(Number));
  });
});
