function waitForDelay(duration: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

export default waitForDelay;
