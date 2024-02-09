export function waitForDelay(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}
