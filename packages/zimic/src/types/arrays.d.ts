interface ArrayConstructor {
  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  isArray<Item>(value: unknown): value is Item[];
}
