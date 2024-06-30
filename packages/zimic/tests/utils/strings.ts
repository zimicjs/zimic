export function prefixLines(prefix: string, value: string) {
  return value.replace(/(^|\n)(.)/g, `$1${prefix}$2`);
}
