export async function usingElapsedTime<ReturnType>(callback: () => Promise<ReturnType>) {
  const startTime = performance.now();

  const result = await callback();

  const endTime = performance.now();
  const elapsedTime = endTime - startTime;

  return { result, startTime, endTime, elapsedTime };
}
