import { PossiblePromise } from '@/types/utils';

export async function usingConsoleTime<ReturnType>(
  label: string,
  callback: () => PossiblePromise<ReturnType>,
): Promise<ReturnType> {
  console.time(label);

  try {
    return await callback();
  } finally {
    console.timeEnd(label);
  }
}
