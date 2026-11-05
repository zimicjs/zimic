import ValidationError from './ValidationError';

export interface ExpectedTypeByTypeOfResult {
  undefined: undefined;
  boolean: boolean;
  number: number;
  bigint: bigint;
  string: string;
  function: (...parameters: never[]) => unknown;
  object: object;
}

export type TypeOfResult = keyof ExpectedTypeByTypeOfResult;

export type AssertedType<
  Value,
  ExpectedType extends TypeOfResult,
  Nullable extends boolean = false,
  Optional extends boolean = false,
> = Value &
  (
    | ExpectedTypeByTypeOfResult[ExpectedType]
    | (Nullable extends true ? null : never)
    | (Optional extends true ? undefined : never)
  );

export interface AssertTypeOfOptions<Nullable extends boolean = false, Optional extends boolean = false> {
  nullable?: Nullable;
  optional?: Optional;
}

function assertTypeOf<
  Value,
  ExpectedType extends TypeOfResult,
  Nullable extends boolean = false,
  Optional extends boolean = false,
>(
  field: string,
  value: Value,
  expectedTypeOrTypes: ExpectedType | readonly ExpectedType[],
  options?: AssertTypeOfOptions<Nullable, Optional>,
): asserts value is AssertedType<Value, ExpectedType, Nullable, Optional> {
  const expectedTypes = typeof expectedTypeOrTypes === 'string' ? [expectedTypeOrTypes] : expectedTypeOrTypes;

  // `typeof null` is 'object', so null gets its own type and is accepted only with the `nullable` option.
  const actualType = value === null ? 'null' : typeof value;

  if (
    !expectedTypes.some((expectedType) => expectedType === actualType) &&
    !(options?.nullable && value === null) &&
    !(options?.optional && value === undefined)
  ) {
    throw new ValidationError(`Expected ${field} to be ${expectedTypes.join(' or ')}, but got ${actualType}.`);
  }
}

export default assertTypeOf;
