type ClassName = string | boolean | number | null | undefined;

export function cn(...classNames: ClassName[]) {
  return classNames.filter(Boolean).join(' ');
}
