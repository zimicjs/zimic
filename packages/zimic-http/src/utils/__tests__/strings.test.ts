import { describe, expect, it } from 'vitest';

import { convertToPascalCase } from '../strings';

describe('String utilities', () => {
  describe('Pascal case', () => {
    it('should correctly convert a string to pascal case', () => {
      expect(convertToPascalCase('string')).toBe('String');
      expect(convertToPascalCase('string value')).toBe('StringValue');
      expect(convertToPascalCase('string-value')).toBe('StringValue');
      expect(convertToPascalCase('string_value')).toBe('StringValue');
      expect(convertToPascalCase('string value1')).toBe('StringValue1');
      expect(convertToPascalCase('string value 1')).toBe('StringValue1');
      expect(convertToPascalCase('string value-1')).toBe('StringValue1');
      expect(convertToPascalCase('string value value')).toBe('StringValueValue');

      expect(convertToPascalCase('String')).toBe('String');
      expect(convertToPascalCase('StrIng')).toBe('StrIng');
      expect(convertToPascalCase('StringValue')).toBe('StringValue');
      expect(convertToPascalCase('String-Value')).toBe('StringValue');
      expect(convertToPascalCase('String_Value')).toBe('StringValue');
      expect(convertToPascalCase('StrING vALue VALue')).toBe('StrINGVALueVALue');
    });
  });
});
