export function random(lowerLimit: number, upperLimit: number): number {
  const range = Math.max(upperLimit - lowerLimit, 0);

  if (range === 0) {
    return lowerLimit;
  }

  return Math.random() * range + lowerLimit;
}

export function randomInt(lowerLimit: number, upperLimit: number): number {
  return Math.floor(random(lowerLimit, upperLimit));
}
