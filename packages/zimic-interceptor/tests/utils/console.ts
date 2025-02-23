import { PossiblePromise } from '@zimic/utils/types';
import { MockInstance, vi } from 'vitest';

type IgnorableConsoleMethod = 'error' | 'warn' | 'info' | 'log' | 'debug';

type SpyByConsoleMethod<Method extends IgnorableConsoleMethod = IgnorableConsoleMethod> = {
  [Key in Method]: MockInstance;
};

export async function usingIgnoredConsole<Method extends IgnorableConsoleMethod>(
  ignoredMethods: Method[],
  callback: (spyByMethod: SpyByConsoleMethod<Method>) => PossiblePromise<void>,
) {
  const initialSpyByMethod = {} as SpyByConsoleMethod<Method>;

  const spyByMethod = ignoredMethods.reduce((groupedSpies, method) => {
    const spy = vi.spyOn(console, method).mockImplementation(vi.fn());
    groupedSpies[method] = spy;
    return groupedSpies;
  }, initialSpyByMethod);

  try {
    await callback(spyByMethod);
  } finally {
    for (const spy of Object.values<MockInstance>(spyByMethod)) {
      spy.mockRestore();
    }
  }
}
