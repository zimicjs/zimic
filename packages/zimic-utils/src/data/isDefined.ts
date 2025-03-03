function isDefined<Value>(value: Value): value is NonNullable<Value> {
  return value !== undefined && value !== null;
}

export default isDefined;
