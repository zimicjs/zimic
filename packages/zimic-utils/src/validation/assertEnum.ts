import ValidationError from './ValidationError';

function assertEnum<Value, ExpectedValue>(
  field: string,
  value: Value,
  enumValues: ExpectedValue[] | readonly ExpectedValue[],
): asserts value is Value & ExpectedValue {
  if (!enumValues.includes(value as never)) {
    throw new ValidationError(`Expected ${field} to be one of ${enumValues.join(', ')}, but got ${String(value)}.`);
  }
}

export default assertEnum;
