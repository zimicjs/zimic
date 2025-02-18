interface ArrayConstructor {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  isArray<Item>(value: unknown): value is Item[];
}
