import { MockInstance, vi } from 'vitest';

import { PossiblePromise } from '@/types/utils';

type SpyByConsoleMethod = {
  [Key in keyof Console]?: MockInstance;
};

export async function usingIgnoredConsole(
  ignoredMethods: (keyof Console)[],
  callback: (spyByMethod: SpyByConsoleMethod) => PossiblePromise<void>,
) {
  const spyByMethod = ignoredMethods.reduce<SpyByConsoleMethod>((groupedSpies, method) => {
    const spy = vi.spyOn(console, method).mockImplementation(vi.fn());
    groupedSpies[method] = spy;
    return groupedSpies;
  }, {});

  try {
    await callback(spyByMethod);
  } finally {
    for (const spy of Object.values(spyByMethod)) {
      spy.mockRestore();
    }
  }
}
