import { expect } from 'vitest';

export function expectPossiblePromise<FulfilledResult>(
  value: FulfilledResult,
  options: {
    shouldBePromise: boolean;
  },
): FulfilledResult {
  const { shouldBePromise } = options;

  if (shouldBePromise) {
    expect(value).toHaveProperty('then', expect.any(Function));
    expect(value).toHaveProperty('catch', expect.any(Function));
    expect(value).toHaveProperty('finally', expect.any(Function));
  } else if (value !== undefined && value !== null) {
    expect(value).not.toHaveProperty('then');
    expect(value).not.toHaveProperty('catch');
    expect(value).not.toHaveProperty('finally');
  }

  return value;
}
