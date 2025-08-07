import { describe, expectTypeOf, it } from 'vitest';

import { HttpPathParamsSerialized } from '../types';

describe('HttpPathParams', () => {
  describe('Types', () => {
    it('should correctly serialize a type to search params', () => {
      type SerializedPathParams = HttpPathParamsSerialized<{
        requiredString: string;
        requiredUndefinedString: string | undefined;
        optionalString?: string;
        requiredNumber: number;
        requiredUndefinedNumber: number | undefined;
        optionalNumber?: number;
        requiredBoolean: boolean;
        requiredUndefinedBoolean: boolean | undefined;
        optionalBoolean?: boolean;

        requiredEnum: 'value1' | 'value2';
        optionalEnum?: 'value1' | 'value2';
        nullableNumber: number | null;

        stringArray: string[];
        numberArray: number[];
        booleanArray: boolean[];

        object: { property: string };

        date: Date;
        method: () => void;
        symbol: symbol;
        map: Map<number, string>;
        set: Set<string>;
        error: Error;
      }>;

      expectTypeOf<SerializedPathParams>().branded.toEqualTypeOf<{
        requiredString: string;
        requiredUndefinedString: string | undefined;
        optionalString?: string;
        requiredNumber: `${number}`;
        requiredUndefinedNumber: `${number}` | undefined;
        optionalNumber?: `${number}`;
        requiredBoolean: `${boolean}`;
        requiredUndefinedBoolean: `${boolean}` | undefined;
        optionalBoolean?: `${boolean}`;

        requiredEnum: 'value1' | 'value2';
        optionalEnum?: 'value1' | 'value2';
        nullableNumber: `${number}` | 'null';

        stringArray: string;
        numberArray: string;
        booleanArray: string;

        object: string;

        date: string;
        method: string;
        map: string;
        set: string;
        error: string;
      }>();
    });
  });
});
