export function waitForDelay(delayDuration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayDuration));
}
