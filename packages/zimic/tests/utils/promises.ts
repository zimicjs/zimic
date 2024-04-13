import { expect } from 'vitest';

export function expectPossiblePromise<FulfilledResult>(
  value: FulfilledResult,
  options: {
    shouldBePromise: boolean;
  },
): FulfilledResult {
  const { shouldBePromise } = options;

  if (shouldBePromise) {
    expect(value).toBeInstanceOf(Promise);
  } else {
    expect(value).not.toBeInstanceOf(Promise);
  }

  return value;
}
