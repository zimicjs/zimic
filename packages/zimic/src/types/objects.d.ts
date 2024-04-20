interface ObjectConstructor {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  entries<Type>(object: Type): [keyof Type & string, Type[keyof Type]][];
}
