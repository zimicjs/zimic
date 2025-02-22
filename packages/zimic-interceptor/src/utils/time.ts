export function waitForDelay(delayDuration: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayDuration);
  });
}
