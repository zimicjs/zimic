interface String {
  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  toLowerCase<Type = string>(): Lowercase<Type>;

  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  toUpperCase<Type = string>(): Uppercase<Type>;
}
