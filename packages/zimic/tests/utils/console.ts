import { MockInstance, vi } from 'vitest';

import { PossiblePromise } from '@/types/utils';

type SpyByConsoleMethod<Method extends keyof Console = keyof Console> = { [Key in Method]: MockInstance };

export async function usingIgnoredConsole<Method extends keyof Console>(
  ignoredMethods: Method[],
  callback: (spyByMethod: SpyByConsoleMethod<Method>) => PossiblePromise<void>,
) {
  const spyByMethod = ignoredMethods.reduce<SpyByConsoleMethod<Method>>((groupedSpies, method) => {
    const spy = vi.spyOn(console, method).mockImplementation(vi.fn());
    groupedSpies[method] = spy;
    return groupedSpies;
  }, {} as SpyByConsoleMethod<Method>); // eslint-disable-line @typescript-eslint/prefer-reduce-type-parameter

  try {
    await callback(spyByMethod);
  } finally {
    for (const spy of Object.values<MockInstance>(spyByMethod)) {
      spy.mockRestore();
    }
  }
}
