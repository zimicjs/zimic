import isDefined from './isDefined';

function isNonEmpty<Value>(value: Value): value is Exclude<NonNullable<Value>, ''> {
  return isDefined(value) && value !== '';
}

export default isNonEmpty;
