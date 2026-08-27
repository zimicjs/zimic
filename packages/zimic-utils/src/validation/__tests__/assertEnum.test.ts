import { describe, expect, expectTypeOf, it } from 'vitest';

import assertEnum from '../assertEnum';
import ValidationError from '../ValidationError';

describe('assertEnum', () => {
  const types = ['local', 'remote'] as const;

  it('should not throw when the value is one of the enum values', () => {
    expect(() => {
      assertEnum('options.type', 'local', types);
    }).not.toThrow();
  });

  it('should throw a ValidationError when the value is not one of the enum values', () => {
    expect(() => {
      assertEnum('options.type', 'unknown', types);
    }).toThrow(new ValidationError('Expected options.type to be one of local, remote, but got unknown.'));
  });

  it('should stringify the received value in the error message', () => {
    expect(() => {
      assertEnum('options.type', undefined, types);
    }).toThrow(new ValidationError('Expected options.type to be one of local, remote, but got undefined.'));
  });

  describe('types', () => {
    it('should narrow the value to the enum values', () => {
      const value = 'local' as string;

      assertEnum('options.type', value, types);
      expectTypeOf(value).toEqualTypeOf<'local' | 'remote'>();
    });

    it('should narrow unknown values to the enum values', () => {
      const value: unknown = 'local';

      assertEnum('options.type', value, types);
      expectTypeOf(value).toEqualTypeOf<'local' | 'remote'>();
    });

    it('should preserve the original type when it is narrower than the enum values', () => {
      const value = 'local' as const;

      assertEnum('options.type', value, types);
      expectTypeOf(value).toEqualTypeOf<'local'>();
    });

    it('should accept mutable enum arrays', () => {
      const value: unknown = 'local';

      assertEnum('options.type', value, ['local', 'remote']);
      expectTypeOf(value).toEqualTypeOf<string>();
    });
  });
});
