import { describe, expectTypeOf, it } from 'vitest';

import { JSONValue, JSONSerialized } from '../json';

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
});
