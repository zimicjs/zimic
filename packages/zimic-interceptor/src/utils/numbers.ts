export function randomInt(lowerLimit: number, upperLimit: number): number {
  const range = upperLimit - lowerLimit;
  return Math.floor(Math.random() * range + lowerLimit);
}
