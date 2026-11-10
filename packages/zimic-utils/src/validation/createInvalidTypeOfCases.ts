import { AssertTypeOfOptions, TypeOfResult } from './assertTypeOf';

export interface InvalidTypeOfCase {
  label: string;
  value: unknown;
  actualType: TypeOfResult | 'null';
}

const TYPE_OF_CASES: InvalidTypeOfCase[] = [
  { label: 'undefined', value: undefined, actualType: 'undefined' },
  { label: 'null', value: null, actualType: 'null' },
  { label: 'a boolean', value: true, actualType: 'boolean' },
  { label: 'a number', value: 5, actualType: 'number' },
  { label: 'a bigint', value: 5n, actualType: 'bigint' },
  { label: 'a string', value: 'value', actualType: 'string' },
  { label: 'a function', value: () => undefined, actualType: 'function' },
  { label: 'an object', value: {}, actualType: 'object' },
  { label: 'an array', value: [], actualType: 'object' },
];

/**
 * Creates the values that `assertTypeOf` rejects for one or more expected types, to use as invalid cases in tests. Pass
 * the same expected types and `nullable` and `optional` options as the assertion.
 */
function createInvalidTypeOfCases(
  expectedTypeOrTypes: TypeOfResult | readonly TypeOfResult[],
  options: AssertTypeOfOptions<boolean, boolean> = {},
): InvalidTypeOfCase[] {
  const expectedTypes = typeof expectedTypeOrTypes === 'string' ? [expectedTypeOrTypes] : expectedTypeOrTypes;

  return TYPE_OF_CASES.filter(
    ({ value, actualType }) =>
      !expectedTypes.some((expectedType) => expectedType === actualType) &&
      !(options.nullable && value === null) &&
      !(options.optional && value === undefined),
  );
}

export default createInvalidTypeOfCases;
