import { PossiblePromise } from '@zimic/utils/types';
import { MockInstance, vi } from 'vitest';

const _IGNORABLE_CONSOLE_METHODS = ['error', 'warn', 'info', 'log', 'debug'] satisfies (keyof Console)[];
type IgnorableConsoleMethod = (typeof _IGNORABLE_CONSOLE_METHODS)[number];

export type SpiedConsole<Method extends IgnorableConsoleMethod = IgnorableConsoleMethod> = Console & {
  [Key in Method]: MockInstance;
};

export async function usingIgnoredConsole<Method extends IgnorableConsoleMethod, ReturnType>(
  ignoredMethods: Method[],
  callback: (spiedConsole: SpiedConsole<Method>) => PossiblePromise<ReturnType>,
) {
  for (const method of ignoredMethods) {
    vi.spyOn(console, method);
  }

  const spiedConsole = console satisfies Console as SpiedConsole<Method>;

  for (const method of ignoredMethods) {
    spiedConsole[method].mockImplementation(vi.fn());
  }

  try {
    const result = await callback(spiedConsole);
    return result;
  } finally {
    for (const method of ignoredMethods) {
      spiedConsole[method].mockRestore();
    }
  }
}
