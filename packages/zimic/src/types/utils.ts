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

type LastUnionType<Union> =
  UnionToIntersection<Union extends unknown ? (union: Union) => void : never> extends (x: infer LastType) => void
    ? LastType
    : never;

export type UnionToTuple<Union, LastType = LastUnionType<Union>> = [Union] extends [never]
  ? []
  : [...UnionToTuple<Exclude<Union, LastType>>, LastType];

export type UnionHasMoreThanOneType<Union> = [UnionToIntersection<Union>] extends [never] ? true : false;

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

export type NonArrayKey<Type> =
  string | number extends ArrayKey<Type> ? keyof Type : Exclude<keyof Type, ArrayKey<Type>>;

export type NonEmptyArray<Type> = [Type, ...Type[]];

export type ReplaceBy<Type, Source, Target> = Type extends Source ? Target : Type;

export type Collection<Type> = Type[] | Set<Type>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DeepPartial<Type> = Type extends Function
  ? Type
  : Type extends (infer ArrayItem)[]
    ? DeepPartial<ArrayItem>[]
    : Type extends object
      ? { [Key in keyof Type]?: DeepPartial<Type[Key]> }
      : Type;

export type Override<Type, OverrideType> = Omit<Type, keyof OverrideType> & OverrideType;
