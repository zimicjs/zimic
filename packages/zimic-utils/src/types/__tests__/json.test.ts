import { describe, expectTypeOf, it } from 'vitest';

import { JSONValue, JSONSerialized, JSONStringified } from '../json';

describe('JSON types', () => {
  it('should type JSON values correctly', () => {
    'a' satisfies JSONValue;
    1 satisfies JSONValue;
    true satisfies JSONValue;
    false satisfies JSONValue;
    null satisfies JSONValue;
    undefined satisfies JSONValue;
    ['e'] satisfies JSONValue;
    [{ g: 'g' }] satisfies JSONValue;
    ({ a: 1, b: { c: { d: [] } } }) satisfies JSONValue;

    ({
      a: 'a',
      b: 1,
      c: true,
      d: false,
      e: null,
      f: ['e'],
      g: [{ g: 'g' }],
      h: { a: 1, b: { c: { d: [] } } },
    }) satisfies JSONValue;

    // @ts-expect-error Dates are not a strict JSON value
    Date satisfies JSONValue;
    // @ts-expect-error Functions are not a strict JSON value
    (() => {}) satisfies JSONValue; // eslint-disable-line @typescript-eslint/no-empty-function

    ({
      a: Date,
      b: () => {}, // eslint-disable-line @typescript-eslint/no-empty-function
      c: Symbol('c'),
      d: Error,
      // @ts-expect-error Object with non-JSON values are not a strict JSON value
    }) satisfies JSONValue;
  });

  it('should validate if type declarations are JSON-compatible', () => {
    // Checking compatibility with abstract JSON value
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
    expectTypeOf<JSONValue<JSONValue>>().not.toBeAny();

    expectTypeOf<JSONValue<string>>().not.toBeAny();
    expectTypeOf<JSONValue<number>>().not.toBeAny();
    expectTypeOf<JSONValue<boolean>>().not.toBeAny();
    expectTypeOf<JSONValue<null>>().not.toBeAny();
    expectTypeOf<JSONValue<undefined>>().not.toBeAny();
    expectTypeOf<JSONValue<string[]>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a: string }>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a?: string }>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a: string | undefined }>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a?: string | undefined }>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a: string }[]>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a: string; b: { c: { d: string[] } } }>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a: string | null }>>().not.toBeAny();
    expectTypeOf<JSONValue<{ a: null; b: undefined }>>().not.toBeAny();

    // @ts-expect-error Dates are not JSON-compatible
    expectTypeOf<JSONValue<Date>>().not.toBeAny();
    // @ts-expect-error Dates are not JSON-compatible
    expectTypeOf<JSONValue<{ a: Date[]; b: string }>>().not.toBeAny();
    // @ts-expect-error Functions are not JSON-compatible
    expectTypeOf<JSONValue<() => void>>().not.toBeAny();
    // @ts-expect-error Functions are not JSON-compatible
    expectTypeOf<JSONValue<(value: string, otherValue: Map<number, string>) => Error>>().not.toBeAny();

    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONValue<{ a: Date }>>().not.toBeAny();
    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONValue<{ a: () => void }>>().not.toBeAny();
    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONValue<{ a: symbol }>>().not.toBeAny();
    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONValue<{ a: Error }>>().not.toBeAny();
  });

  it('should convert types to their JSON-serialized versions', () => {
    expectTypeOf<JSONSerialized<string>>().toEqualTypeOf<string>();
    expectTypeOf<JSONSerialized<number>>().toEqualTypeOf<number>();
    expectTypeOf<JSONSerialized<boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<JSONSerialized<null>>().toEqualTypeOf<null>();
    expectTypeOf<JSONSerialized<undefined>>().toEqualTypeOf<undefined>();
    expectTypeOf<JSONSerialized<string[]>>().toEqualTypeOf<string[]>();
    expectTypeOf<JSONSerialized<{ a: string }>>().toEqualTypeOf<{ a: string }>();
    expectTypeOf<JSONSerialized<{ a?: string }>>().toEqualTypeOf<{ a?: string }>();
    expectTypeOf<JSONSerialized<{ a: string | undefined }>>().toEqualTypeOf<{ a: string | undefined }>();
    expectTypeOf<JSONSerialized<{ a?: string | undefined }>>().toEqualTypeOf<{ a?: string | undefined }>();
    expectTypeOf<JSONSerialized<{ a: string }[]>>().toEqualTypeOf<{ a: string }[]>();
    expectTypeOf<
      JSONSerialized<{
        a: string;
        b: { c: { d: string[] } };
      }>
    >().toEqualTypeOf<{
      a: string;
      b: { c: { d: string[] } };
    }>();
    expectTypeOf<JSONSerialized<{ a: string | null }>>().toEqualTypeOf<{ a: string | null }>();

    expectTypeOf<JSONSerialized<Date>>().toEqualTypeOf<string>();
    expectTypeOf<JSONSerialized<symbol>>().toEqualTypeOf<never>();
    expectTypeOf<JSONSerialized<Map<never, never>>>().toEqualTypeOf<Record<string, never>>();
    expectTypeOf<JSONSerialized<Set<never>>>().toEqualTypeOf<Record<string, never>>();
    expectTypeOf<JSONSerialized<{ a: Date }>>().toEqualTypeOf<{ a: string }>();
    expectTypeOf<JSONSerialized<{ a: Date[]; b: string }>>().toEqualTypeOf<{ a: string[]; b: string }>();
    expectTypeOf<JSONSerialized<() => void>>().toEqualTypeOf<never>();
    expectTypeOf<JSONSerialized<{ a: () => void }>>().toEqualTypeOf<{}>();
    expectTypeOf<JSONSerialized<{ a: () => void; b: string }>>().toEqualTypeOf<{ b: string }>();
    expectTypeOf<
      JSONSerialized<{
        a: (value: string, otherValue: Map<number, string>) => Error;
        b: string;
      }>
    >().toEqualTypeOf<{
      b: string;
    }>();
    expectTypeOf<JSONSerialized<{ a: symbol; b: string }>>().toEqualTypeOf<{ b: string }>();
    expectTypeOf<
      JSONSerialized<{
        a: Error;
        b: string;
      }>
    >().toEqualTypeOf<{
      a: { name: string; message: string; stack?: string };
      b: string;
    }>();
  });

  it('should convert types to their JSON-stringified versions', () => {
    expectTypeOf(JSON.stringify('')).toEqualTypeOf<JSONStringified<string>>();
    expectTypeOf(JSON.stringify(0)).toEqualTypeOf<JSONStringified<number>>();
    expectTypeOf(JSON.stringify(true)).toEqualTypeOf<JSONStringified<boolean>>();
    expectTypeOf(JSON.stringify(null)).toEqualTypeOf<JSONStringified<null>>();
    expectTypeOf(JSON.stringify(undefined)).toEqualTypeOf<JSONStringified<undefined>>();
    expectTypeOf(JSON.stringify(['a', 'b', 'c'])).toEqualTypeOf<JSONStringified<string[]>>();
    expectTypeOf(JSON.stringify({ a: 'a', b: 1 })).toEqualTypeOf<JSONStringified<{ a: string; b: number }>>();

    expectTypeOf(JSON.stringify(new Date())).toEqualTypeOf<JSONStringified<string>>();
    expectTypeOf(JSON.stringify(Symbol('a'))).toEqualTypeOf<JSONStringified<never>>();
    expectTypeOf(JSON.stringify(new Map())).toEqualTypeOf<JSONStringified<Record<string, never>>>();
    expectTypeOf(JSON.stringify(new Set())).toEqualTypeOf<JSONStringified<Record<string, never>>>();

    expectTypeOf(JSON.stringify({ a: new Date() })).toEqualTypeOf<JSONStringified<{ a: string }>>();
    expectTypeOf(JSON.stringify({ a: [new Date()], b: 'b' })).toEqualTypeOf<
      JSONStringified<{ a: string[]; b: string }>
    >();
    expectTypeOf(JSON.stringify(() => undefined)).toEqualTypeOf<JSONStringified<never>>();
    expectTypeOf(JSON.stringify({ a: () => undefined })).toEqualTypeOf<JSONStringified<{}>>();
    expectTypeOf(JSON.stringify({ a: () => undefined, b: 'b' })).toEqualTypeOf<JSONStringified<{ b: string }>>();
    expectTypeOf(JSON.stringify({ a: () => undefined, b: 'b' })).toEqualTypeOf<JSONStringified<{ b: string }>>();
    expectTypeOf(JSON.stringify({ a: Symbol('a'), b: 'b' })).toEqualTypeOf<JSONStringified<{ b: string }>>();
    expectTypeOf(JSON.stringify({ a: new Error(), b: 'b' })).toEqualTypeOf<
      JSONStringified<{
        a: { name: string; message: string; stack?: string };
        b: string;
      }>
    >();
  });

  it('should parse JSON-stringified types to their JSON-serialized versions', () => {
    expectTypeOf(JSON.parse(JSON.stringify(''))).toEqualTypeOf<string>();
    expectTypeOf(JSON.parse(JSON.stringify(0))).toEqualTypeOf<number>();
    expectTypeOf(JSON.parse(JSON.stringify(true))).toEqualTypeOf<boolean>();
    expectTypeOf(JSON.parse(JSON.stringify(null))).toEqualTypeOf<null>();
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    expectTypeOf(JSON.parse(JSON.stringify(undefined))).toEqualTypeOf<undefined>();
    expectTypeOf(JSON.parse(JSON.stringify(['a', 'b', 'c']))).toEqualTypeOf<string[]>();
    expectTypeOf(JSON.parse(JSON.stringify({ a: 'a', b: 1 }))).toEqualTypeOf<{ a: string; b: number }>();

    expectTypeOf(JSON.parse(JSON.stringify(new Date()))).toEqualTypeOf<string>();
    expectTypeOf(JSON.parse(JSON.stringify(Symbol('a')))).toEqualTypeOf<never>();
    expectTypeOf(JSON.parse(JSON.stringify(new Map()))).toEqualTypeOf<Record<string, never>>();
    expectTypeOf(JSON.parse(JSON.stringify(new Set()))).toEqualTypeOf<Record<string, never>>();

    expectTypeOf(JSON.parse(JSON.stringify({ a: new Date() }))).toEqualTypeOf<{ a: string }>();
    expectTypeOf(JSON.parse(JSON.stringify({ a: [new Date()], b: 'b' }))).toEqualTypeOf<{
      a: string[];
      b: string;
    }>();
    expectTypeOf(JSON.parse(JSON.stringify(() => undefined))).toEqualTypeOf<never>();
    expectTypeOf(JSON.parse(JSON.stringify({ a: () => undefined }))).toEqualTypeOf<{}>();
    expectTypeOf(JSON.parse(JSON.stringify({ a: () => undefined, b: 'b' }))).toEqualTypeOf<{ b: string }>();
    expectTypeOf(JSON.parse(JSON.stringify({ a: () => undefined, b: 'b' }))).toEqualTypeOf<{ b: string }>();
    expectTypeOf(JSON.parse(JSON.stringify({ a: Symbol('a'), b: 'b' }))).toEqualTypeOf<{ b: string }>();
    expectTypeOf(JSON.parse(JSON.stringify({ a: new Error(), b: 'b' }))).toEqualTypeOf<{
      a: { name: string; message: string; stack?: string };
      b: string;
    }>();
  });
});
