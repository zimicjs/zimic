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
  for (const method of ignoredMethods) {
    vi.spyOn(console, method).mockImplementation(vi.fn());
  }

  const spiedConsole = console as Console & SpyByConsoleMethod<Method>;

  try {
    const result = await callback(spiedConsole);
    return result;
  } finally {
    for (const method of ignoredMethods) {
      spiedConsole[method].mockRestore();
    }
  }
}
