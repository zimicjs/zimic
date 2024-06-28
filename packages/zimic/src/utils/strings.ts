export function toPascalCase(value: string) {
  return value.replace(/(?:^|[^\w\d])(\w)/g, (_, letter: string) => letter.toUpperCase());
}

export function prefixLines(prefix: string, value: string) {
  return value.replace(/(^|\n)(.)/g, `$1${prefix}$2`);
}
