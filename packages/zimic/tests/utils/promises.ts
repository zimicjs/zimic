import { expect } from 'vitest';

import { PossiblePromise } from '@/types/utils';

export async function expectPossiblePromise<FulfilledResult>(
  possiblePromise: PossiblePromise<FulfilledResult>,
  options: {
    shouldBePromise: boolean;
  },
): Promise<FulfilledResult> {
  const { shouldBePromise } = options;

  if (shouldBePromise) {
    expect(possiblePromise).toBeInstanceOf(Promise);
    await expect(possiblePromise).resolves.not.toThrowError();
    return possiblePromise;
  } else {
    expect(possiblePromise).not.toBeInstanceOf(Promise);
    return possiblePromise;
  }
}
