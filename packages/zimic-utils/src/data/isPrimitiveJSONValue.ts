import { JSONValue } from '@/types/json';

export function isPrimitiveJSONValue<Value extends JSONValue>(value: Value): value is Exclude<Value, object> {
  return typeof value !== 'object' || value === null;
}
