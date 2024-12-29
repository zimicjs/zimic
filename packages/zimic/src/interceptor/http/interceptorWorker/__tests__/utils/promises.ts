import { expectPossiblePromise } from '@tests/utils/promises';

export function promiseIfRemote<FulfilledResult>(
  value: FulfilledResult,
  comparisonEntity: { type: 'local' | 'remote' },
): FulfilledResult {
  return expectPossiblePromise(value, {
    shouldBePromise: comparisonEntity.type === 'remote',
  });
}
