import { describe, expect, it } from 'vitest';

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

  it('should throw when the value is null but the nullable option is disabled', () => {
    expect(() => {
      assertTypeOf('field', null, 'string', { nullable: false });
    }).toThrow(new ValidationError('Expected field to be string, but got object.'));
  });

  it('should throw when the value is undefined but the optional option is disabled', () => {
    expect(() => {
      assertTypeOf('field', undefined, 'string', { optional: false });
    }).toThrow(new ValidationError('Expected field to be string, but got undefined.'));
  });

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
});
