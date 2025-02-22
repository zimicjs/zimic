type ObjectKey<Type> = keyof Type & string;
type ObjectValue<Type> = Type[ObjectKey<Type>];
type ObjectEntry<Type> = [ObjectKey<Type>, ObjectValue<Type>];

interface ObjectConstructor {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  keys<Type>(object: Type): ObjectKey<Type>[];

  // eslint-disable-next-line @typescript-eslint/method-signature-style
  values<Type>(object: Type): ObjectValue<Type>[];

  // eslint-disable-next-line @typescript-eslint/method-signature-style
  entries<Type>(object: Type): ObjectEntry<Type>[];
}
