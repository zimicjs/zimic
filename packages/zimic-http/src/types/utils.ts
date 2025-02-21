export type Default<Type, IfEmpty = never> = [undefined | void] extends [Type]
  ? IfEmpty
  : Exclude<Type, undefined | void>;

export type DefaultNoExclude<Type, IfEmpty = never> = [undefined | void] extends Type ? IfEmpty : Type;

export type IfAny<Type, Yes, No = Type> = 0 extends 1 & Type ? Yes : No;

export type IfNever<Type, Yes, No = Type> = [Type] extends [never] ? Yes : No;

export type PossiblePromise<Type> = Type | PromiseLike<Type>;

export type UnionToIntersection<Union> = (Union extends unknown ? (union: Union) => void : never) extends (
  intersectedUnion: infer IntersectedUnion,
) => void
  ? IntersectedUnion
  : never;

export type UnionHasMoreThanOneType<Union> = [UnionToIntersection<Union>] extends [never] ? true : false;

export type Prettify<Type> = {
  [Key in keyof Type]: Type[Key];
};

export type ArrayItemIfArray<Type> = Type extends (infer Item)[] ? Item : Type;

type PickArrayProperties<Type> = {
  [Key in keyof Type as never[] extends Type[Key] ? Key : never]: Type[Key];
};

export type ArrayKey<Type> = keyof PickArrayProperties<Type>;

export type NonArrayKey<Type> =
  string | number extends ArrayKey<Type> ? keyof Type : Exclude<keyof Type, ArrayKey<Type>>;

export type NonEmptyArray<Type> = [Type, ...Type[]];

export type ReplaceBy<Type, Source, Target> = Type extends Source ? Target : Type;

export type Override<Type, OverrideType> = Omit<Type, keyof OverrideType> & OverrideType;
