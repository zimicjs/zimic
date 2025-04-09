import { PossiblePromise } from '@zimic/utils/types';
import { MockInstance, vi } from 'vitest';

type IgnorableConsoleMethod = 'error' | 'warn' | 'info' | 'log' | 'debug';

type SpyByConsoleMethod<Method extends IgnorableConsoleMethod = IgnorableConsoleMethod> = {
  [Key in Method]: MockInstance;
};

export async function usingIgnoredConsole<Method extends IgnorableConsoleMethod, ReturnType>(
  ignoredMethods: Method[],
  callback: (spiedConsole: Console & SpyByConsoleMethod<Method>) => PossiblePromise<ReturnType>,
) {
  const initialSpyByMethod = {} as SpyByConsoleMethod<Method>;

  const spyByMethod = ignoredMethods.reduce((groupedSpies, method) => {
    const spy = vi.spyOn(console, method).mockImplementation(vi.fn());
    groupedSpies[method] = spy;
    return groupedSpies;
  }, initialSpyByMethod);

  try {
    const result = await callback(console as Console & SpyByConsoleMethod<Method>);
    return result;
  } finally {
    for (const spy of Object.values<MockInstance>(spyByMethod)) {
      spy.mockRestore();
    }
  }
}
