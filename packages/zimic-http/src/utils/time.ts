import { PossiblePromise } from '@/types/utils';

export async function usingElapsedTime<ReturnType>(callback: () => PossiblePromise<ReturnType>) {
  const startTimeInMilliseconds = performance.now();

  const result = await callback();

  const endTimeInMilliseconds = performance.now();
  const elapsedTimeInMilliseconds = endTimeInMilliseconds - startTimeInMilliseconds;

  return {
    startTime: startTimeInMilliseconds,
    elapsedTime: elapsedTimeInMilliseconds,
    endTime: endTimeInMilliseconds,
    result,
  };
}

export function formatElapsedTime(elapsedTimeInMilliseconds: number) {
  if (elapsedTimeInMilliseconds < 1000) {
    return `${elapsedTimeInMilliseconds.toFixed(0)}ms`;
  } else {
    return `${(elapsedTimeInMilliseconds / 1000).toFixed(2)}s`;
  }
}
