export function convertToPascalCase(value: string) {
  return value.replace(/(?:^|[^A-Za-z\d])([A-Za-z\d])/g, (_match, letter: string) => letter.toUpperCase());
}
