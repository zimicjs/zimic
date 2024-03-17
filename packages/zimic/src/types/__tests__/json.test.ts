import { describe, expectTypeOf, it } from 'vitest';

import { JSONCompatible, JSONSerialized, LooseJSONValue, JSONValue } from '../json';

describe('JSON types', () => {
  it('should type loose JSON values correctly', () => {
    'a' satisfies LooseJSONValue;
    1 satisfies LooseJSONValue;
    true satisfies LooseJSONValue;
    false satisfies LooseJSONValue;
    null satisfies LooseJSONValue;
    undefined satisfies LooseJSONValue;
    ['e'] satisfies LooseJSONValue;
    [{ g: 'g' }] satisfies LooseJSONValue;
    ({ a: 1, b: { c: { d: [] } } }) satisfies LooseJSONValue;
    Date satisfies LooseJSONValue;
    (() => {}) satisfies LooseJSONValue; // eslint-disable-line @typescript-eslint/no-empty-function

    ({
      a: 'a',
      b: 1,
      c: true,
      d: false,
      e: null,
      f: ['e'],
      g: [{ g: 'g' }],
      h: { a: 1, b: { c: { d: [] } } },
    }) satisfies LooseJSONValue;

    ({
      a: Date,
      b: () => {}, // eslint-disable-line @typescript-eslint/no-empty-function
      c: Symbol('c'),
      d: Error,
    }) satisfies LooseJSONValue;
  });

  it('should type strict JSON values correctly', () => {
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
    expectTypeOf<JSONCompatible<string>>().not.toBeAny();
    expectTypeOf<JSONCompatible<number>>().not.toBeAny();
    expectTypeOf<JSONCompatible<boolean>>().not.toBeAny();
    expectTypeOf<JSONCompatible<null>>().not.toBeAny();
    expectTypeOf<JSONCompatible<undefined>>().not.toBeAny();
    expectTypeOf<JSONCompatible<string[]>>().not.toBeAny();
    expectTypeOf<JSONCompatible<{ a?: string }>>().not.toBeAny();
    expectTypeOf<JSONCompatible<{ a: string | undefined }>>().not.toBeAny();
    expectTypeOf<JSONCompatible<{ a: string }[]>>().not.toBeAny();
    expectTypeOf<JSONCompatible<{ a: string; b: { c: { d: string[] } } }>>().not.toBeAny();
    expectTypeOf<JSONCompatible<{ a: null; b: undefined }>>().not.toBeAny();

    // @ts-expect-error Dates are not JSON-compatible
    expectTypeOf<JSONCompatible<Date>>().not.toBeAny();
    // @ts-expect-error Functions are not JSON-compatible
    expectTypeOf<JSONCompatible<() => void>>().not.toBeAny();

    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONCompatible<{ a: Date }>>().not.toBeAny();
    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONCompatible<{ a: () => void }>>().not.toBeAny();
    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONCompatible<{ a: symbol }>>().not.toBeAny();
    // @ts-expect-error Object with non-JSON-compatible values are not JSON-compatible
    expectTypeOf<JSONCompatible<{ a: Error }>>().not.toBeAny();
  });

  it('should convert types to their JSON-serialized versions', () => {
    expectTypeOf<JSONSerialized<string>>().toEqualTypeOf<string>();
    expectTypeOf<JSONSerialized<number>>().toEqualTypeOf<number>();
    expectTypeOf<JSONSerialized<boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<JSONSerialized<null>>().toEqualTypeOf<null>();
    expectTypeOf<JSONSerialized<string[]>>().toEqualTypeOf<string[]>();
    expectTypeOf<JSONSerialized<{ a: string }>>().toEqualTypeOf<{ a: string }>();
    expectTypeOf<JSONSerialized<{ a: string }[]>>().toEqualTypeOf<{ a: string }[]>();
    expectTypeOf<JSONSerialized<{ a: string; b: { c: { d: string[] } } }>>().toEqualTypeOf<{
      a: string;
      b: { c: { d: string[] } };
    }>();

    expectTypeOf<JSONSerialized<Date>>().toEqualTypeOf<string>();
    expectTypeOf<JSONSerialized<undefined>>().toEqualTypeOf<never>();
    expectTypeOf<JSONSerialized<() => void>>().toEqualTypeOf<never>();
    expectTypeOf<JSONSerialized<{ a?: number; b: string }>>().toEqualTypeOf<{ a?: number; b: string }>();
    expectTypeOf<JSONSerialized<{ a: undefined; b: string }>>().toEqualTypeOf<{ b: string }>();
    expectTypeOf<JSONSerialized<{ a: Date[]; b: string }>>().toEqualTypeOf<{ a: string[]; b: string }>();
    expectTypeOf<JSONSerialized<{ a: () => void; b: string }>>().toEqualTypeOf<{ b: string }>();
    expectTypeOf<JSONSerialized<{ a: symbol; b: string }>>().toEqualTypeOf<{ b: string }>();
    expectTypeOf<JSONSerialized<{ a: Error; b: string }>>().toEqualTypeOf<{
      a: { name: string; message: string; stack?: string };
      b: string;
    }>();
  });
});
