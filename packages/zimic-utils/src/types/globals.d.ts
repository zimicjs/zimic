type ObjectKey<Type> = keyof Type & string;
type ObjectValue<Type> = Type[ObjectKey<Type>];
type ObjectEntry<Type> = [ObjectKey<Type>, ObjectValue<Type>];

interface ArrayConstructor {
  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  isArray<Item>(value: unknown): value is Item[];
}

interface ObjectConstructor {
  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  keys<Type>(object: Type): ObjectKey<Type>[];

  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  values<Type>(object: Type): ObjectValue<Type>[];

  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  entries<Type>(object: Type): ObjectEntry<Type>[];
}

interface String {
  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  toLowerCase<Type extends string = string>(): Lowercase<Type>;

  // Using the original method signature style to correctly apply the overload.
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  toUpperCase<Type extends string = string>(): Uppercase<Type>;
}
