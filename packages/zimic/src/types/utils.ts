export type Default<Type, IfEmpty = never> = undefined extends Type
  ? IfEmpty
  : void extends Type
    ? IfEmpty
    : Exclude<Type, undefined | void>;

export type IfAny<Type, Yes, No> = 0 extends 1 & Type ? Yes : No;

export type PossiblePromise<Type> = Type | Promise<Type>;

export type UnionToIntersection<Union> = (Union extends unknown ? (union: Union) => void : never) extends (
  intersectedUnion: infer IntersectedUnion,
) => void
  ? IntersectedUnion
  : never;

export type Prettify<Type> = {
  [Key in keyof Type]: Type[Key];
};

export type NonUndefined<Type> = Exclude<Type, undefined>;

export type NonNullable<Type> = Exclude<Type, null>;

export type Defined<Type> = NonNullable<NonUndefined<Type>>;

export type ArrayItemIfArray<Type> = Type extends (infer Item)[] ? Item : Type;

type PickArrayProperties<Type> = {
  [Key in keyof Type as never[] extends Type[Key] ? Key : never]: Type[Key];
};

export type ArrayKey<Type> = keyof PickArrayProperties<Type>;

export type NonArrayKey<Type> = Exclude<keyof Type, ArrayKey<Type>>;

export type ReplaceBy<Type, Source, Target> = Type extends Source ? Target : Type;
