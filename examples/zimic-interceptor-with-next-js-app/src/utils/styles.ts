type ClassNameValue = string | boolean | number | null | undefined;

export function cn(...classNames: ClassNameValue[]) {
  return classNames.filter(Boolean).join(' ');
}
