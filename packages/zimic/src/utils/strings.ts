export function convertToPascalCase(value: string) {
  return value.replace(/(?:^|[^\w\d])(\w)/g, (_, letter: string) => letter.toUpperCase());
}
