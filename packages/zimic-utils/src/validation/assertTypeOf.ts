import ValidationError from './ValidationError';

export type TypeOfResult = 'undefined' | 'boolean' | 'number' | 'bigint' | 'string' | 'symbol' | 'function' | 'object';

export interface ExpectedTypeByTypeOfResult {
  undefined: undefined;
  boolean: boolean;
  number: number;
  bigint: bigint;
  string: string;
  symbol: symbol;
  function: (...parameters: never[]) => unknown;
  object: object | null;
}

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
  expectedType: ExpectedType,
  options?: AssertTypeOfOptions<Nullable, Optional>,
): asserts value is AssertedType<Value, ExpectedType, Nullable, Optional> {
  const actualType = typeof value;

  if (
    actualType !== expectedType &&
    !(options?.nullable && value === null) &&
    !(options?.optional && value === undefined)
  ) {
    throw new ValidationError(`Expected ${field} to be ${expectedType}, but got ${actualType}.`);
  }
}

export default assertTypeOf;
