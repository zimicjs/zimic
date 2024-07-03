export function convertToPascalCase(value: string) {
  return value.replace(/(?:^|[^\w\d])(\w)/g, (_, letter: string) => letter.toUpperCase());
}

export function convertToCamelCase(value: string) {
  return value
    .replace(/^(\w)/, (_, letter: string) => letter.toLowerCase())
    .replace(/[^\w\d](\w)/g, (_, letter: string) => letter.toUpperCase());
}
