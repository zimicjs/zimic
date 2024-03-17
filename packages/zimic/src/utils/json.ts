import { LooseJSONValue } from '..';

function isPrimitiveJSONValue<Value extends LooseJSONValue>(value: Value): value is Exclude<Value, object> {
  return typeof value !== 'object' || value === null;
}

export function jsonEquals(value: LooseJSONValue, otherValue: LooseJSONValue): boolean {
  if (isPrimitiveJSONValue(value)) {
    return value === otherValue;
  }
  if (isPrimitiveJSONValue(otherValue)) {
    return false;
  }

  if (Array.isArray<LooseJSONValue>(value)) {
    if (!Array.isArray<LooseJSONValue>(otherValue)) {
      return false;
    }
    if (value.length !== otherValue.length) {
      return false;
    }
    return value.every((item, index) => jsonEquals(item, otherValue[index]));
  }

  if (Array.isArray<LooseJSONValue>(otherValue)) {
    return false;
  }

  const valueKeys = Object.keys(value);
  const otherValueKeys = Object.keys(otherValue);

  if (valueKeys.length !== otherValueKeys.length) {
    return false;
  }

  return valueKeys.every((key) => {
    const subValue = value[key] as LooseJSONValue;
    const subOtherValue = otherValue[key] as LooseJSONValue;
    return jsonEquals(subValue, subOtherValue);
  });
}

export function jsonContains(value: LooseJSONValue, otherValue: LooseJSONValue): boolean {
  if (isPrimitiveJSONValue(value)) {
    return value === otherValue;
  }
  if (isPrimitiveJSONValue(otherValue)) {
    return false;
  }

  if (Array.isArray<LooseJSONValue>(value)) {
    if (!Array.isArray<LooseJSONValue>(otherValue)) {
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

  if (Array.isArray<LooseJSONValue>(otherValue)) {
    return false;
  }

  const valueKeys = Object.keys(value);
  const otherValueKeys = Object.keys(otherValue);

  if (valueKeys.length < otherValueKeys.length) {
    return false;
  }

  return otherValueKeys.every((key) => {
    const subValue = value[key] as LooseJSONValue;
    const subOtherValue = otherValue[key] as LooseJSONValue;
    return jsonContains(subValue, subOtherValue);
  });
}
