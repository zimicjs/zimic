import { JSONValue } from '@/types/json';

function isPrimitiveJSONValue<Value extends JSONValue>(value: Value): value is Exclude<Value, object> {
  return typeof value !== 'object' || value === null;
}

export function jsonEquals(value: JSONValue, otherValue: JSONValue): boolean {
  if (isPrimitiveJSONValue(value)) {
    return value === otherValue;
  }
  if (isPrimitiveJSONValue(otherValue)) {
    return false;
  }

  if (Array.isArray<JSONValue>(value)) {
    if (!Array.isArray<JSONValue>(otherValue)) {
      return false;
    }
    if (value.length !== otherValue.length) {
      return false;
    }
    return value.every((item, index) => jsonEquals(item, otherValue[index]));
  }

  if (Array.isArray<JSONValue>(otherValue)) {
    return false;
  }

  const valueKeys = Object.keys(value);
  const otherValueKeys = Object.keys(otherValue);

  if (valueKeys.length !== otherValueKeys.length) {
    return false;
  }

  return valueKeys.every((key) => {
    const subValue = value[key];
    const subOtherValue = otherValue[key];
    return jsonEquals(subValue, subOtherValue);
  });
}

export function jsonContains(value: JSONValue, otherValue: JSONValue): boolean {
  if (isPrimitiveJSONValue(value)) {
    return value === otherValue;
  }
  if (isPrimitiveJSONValue(otherValue)) {
    return false;
  }

  if (Array.isArray<JSONValue>(value)) {
    if (!Array.isArray<JSONValue>(otherValue)) {
      return false;
    }
    if (value.length < otherValue.length) {
      return false;
    }

    let lastMatchedIndex = -1;
    return otherValue.every((otherItem) => {
      for (let index = lastMatchedIndex + 1; index < value.length; index++) {
        if (jsonContains(value[index], otherItem)) {
          lastMatchedIndex = index;
          return true;
        }
      }
      return false;
    });
  }

  if (Array.isArray<JSONValue>(otherValue)) {
    return false;
  }

  const valueKeys = Object.keys(value);
  const otherValueKeys = Object.keys(otherValue);

  if (valueKeys.length < otherValueKeys.length) {
    return false;
  }

  return otherValueKeys.every((key) => {
    const subValue = value[key];
    const subOtherValue = otherValue[key];
    return jsonContains(subValue, subOtherValue);
  });
}
