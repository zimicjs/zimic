import { describe, expect, expectTypeOf, it } from 'vitest';

import assertTypeOf, { TypeOfResult } from '../assertTypeOf';
import ValidationError from '../ValidationError';

describe('assertTypeOf', () => {
  const validCases: { value: unknown; expectedType: TypeOfResult }[] = [
    { value: undefined, expectedType: 'undefined' },
    { value: true, expectedType: 'boolean' },
    { value: 1, expectedType: 'number' },
    { value: 1n, expectedType: 'bigint' },
    { value: 'value', expectedType: 'string' },
    { value: Symbol('value'), expectedType: 'symbol' },
    { value: () => undefined, expectedType: 'function' },
    { value: {}, expectedType: 'object' },
    { value: null, expectedType: 'object' },
  ];

  it.each(validCases)(
    'should not throw when the value matches the expected type (type: $expectedType)',
    ({ value, expectedType }) => {
      expect(() => {
        assertTypeOf('field', value, expectedType);
      }).not.toThrow();
    },
  );

  it('should throw a ValidationError when the value does not match the expected type', () => {
    expect(() => {
      assertTypeOf('options.baseURL', 123, 'string');
    }).toThrow(new ValidationError('Expected options.baseURL to be string, but got number.'));
  });

  it('should not throw when the value is null and the nullable option is enabled', () => {
    expect(() => {
      assertTypeOf('field', null, 'string', { nullable: true });
    }).not.toThrow();
  });

  it('should not throw when the value is undefined and the optional option is enabled', () => {
    expect(() => {
      assertTypeOf('field', undefined, 'string', { optional: true });
    }).not.toThrow();
  });

  it.each([false, undefined])(
    'should throw when the value is null and the nullable option is disabled or omitted (nullable: %s)',
    (nullable) => {
      expect(() => {
        assertTypeOf('field', null, 'string', { nullable });
      }).toThrow(new ValidationError('Expected field to be string, but got object.'));
    },
  );

  it.each([false, undefined])(
    'should throw when the value is undefined and the optional option is disabled or omitted (optional: %s)',
    (optional) => {
      expect(() => {
        assertTypeOf('field', undefined, 'string', { optional });
      }).toThrow(new ValidationError('Expected field to be string, but got undefined.'));
    },
  );

  it('should throw when a non-null mismatch is provided even if the nullable option is enabled', () => {
    expect(() => {
      assertTypeOf('field', 123, 'string', { nullable: true });
    }).toThrow(new ValidationError('Expected field to be string, but got number.'));
  });

  it('should throw when a defined mismatch is provided even if the optional option is enabled', () => {
    expect(() => {
      assertTypeOf('field', 123, 'string', { optional: true });
    }).toThrow(new ValidationError('Expected field to be string, but got number.'));
  });

  describe('types', () => {
    // The values under test are received as parameters so that TypeScript cannot narrow them from an initializer. A
    // `const value: string | null = 'example'` would already have the flow type `string` before any assertion, making
    // these type assertions vacuous.

    it('should narrow the value to the expected type', () => {
      function test(value: string | null) {
        expectTypeOf(value).toEqualTypeOf<string | null>();

        assertTypeOf('field', value, 'string');
        expectTypeOf(value).toEqualTypeOf<string>();
      }

      expect(() => test('example')).not.toThrow();
    });

    it('should keep the value nullable when the nullable option is enabled', () => {
      function test(value: string | null) {
        assertTypeOf('field', value, 'string', { nullable: true });
        expectTypeOf(value).toEqualTypeOf<string | null>();
      }

      expect(() => test('example')).not.toThrow();
    });

    it('should keep the value optional when the optional option is enabled', () => {
      function test(value: string | undefined) {
        assertTypeOf('field', value, 'string', { optional: true });
        expectTypeOf(value).toEqualTypeOf<string | undefined>();
      }

      expect(() => test('example')).not.toThrow();
    });

    it('should remove null and undefined when neither option is enabled', () => {
      function test(value: string | null | undefined) {
        assertTypeOf('field', value, 'string');
        expectTypeOf(value).toEqualTypeOf<string>();
      }

      expect(() => test('example')).not.toThrow();
    });

    it('should narrow unknown values to the expected type', () => {
      function test(value: unknown) {
        assertTypeOf('field', value, 'string');
        expectTypeOf(value).toEqualTypeOf<string>();
      }

      expect(() => test('example')).not.toThrow();
    });
  });
});
