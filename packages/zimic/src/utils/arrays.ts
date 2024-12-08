export function removeArrayIndex<Item>(array: Item[], index: number) {
  if (index >= 0 && index < array.length) {
    array.splice(index, 1);
  }
  return array;
}

export function removeArrayElement<Item>(array: Item[], element: Item) {
  const index = array.indexOf(element);
  return removeArrayIndex(array, index);
}
