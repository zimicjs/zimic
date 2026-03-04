export * from './json';

export type Default<Type, IfEmpty = never> = [undefined | void] extends [Type]
  ? IfEmpty
  : Exclude<Type, undefined | void>;

export type DefaultNoExclude<Type, IfEmpty = never> = [undefined | void] extends Type ? IfEmpty : Type;

export type IfAny<Type, Yes, No = Type> = 0 extends 1 & Type ? Yes : No;

export type IfNever<Type, Yes, No = Type> = [Type] extends [never] ? Yes : No;

export type PossiblePromise<Type> = Type | PromiseLike<Type>;

/** Converts a union type to an intersection type. For example, `A | B` becomes `A & B`. */
export type UnionToIntersection<Union> = (Union extends unknown ? (union: Union) => void : never) extends (
  intersectedUnion: infer IntersectedUnion,
) => void
  ? IntersectedUnion
  : never;

/**
 * Determines if a union type has more than one type in it. If the union is a single type, it evaluates to `false`;
 * otherwise, it evaluates to `true`.
 */
export type UnionHasMoreThanOneType<Union> = [UnionToIntersection<Union>] extends [never] ? true : false;

/**
 * Extracts the values of a specific key from a union of types. If the key does not exist in a type within the union, it
 * evaluates to `never` for that type.
 */
export type IndexUnion<Union, Key> = Union extends Union ? (Key extends keyof Union ? Union[Key] : never) : never;

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

export type Replace<Type, Source, Target> = Type extends Source ? Target : Type;

export type Collection<Type> = Type[] | Set<Type>;

export type PartialByKey<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;

export type RequiredByKey<Type, Key extends keyof Type> = Omit<Type, Key> & Required<Pick<Type, Key>>;

export type DeepPartial<Type> = Type extends (...parameters: never[]) => unknown
  ? Type
  : Type extends (infer ArrayItem)[]
    ? DeepPartial<ArrayItem>[]
    : Type extends object
      ? { [Key in keyof Type]?: DeepPartial<Type[Key]> }
      : Type;

export type Override<Type, OverrideType> = Omit<Type, keyof OverrideType> & OverrideType;

export interface Range<Type> {
  min: Type;
  max: Type;
}

export type ObjectKey<Type> = keyof Type & string;
export type ObjectValue<Type> = Type[ObjectKey<Type>];
export type ObjectEntry<Type> = [ObjectKey<Type>, ObjectValue<Type>];

declare const brand: unique symbol;

/**
 * A utility type to create a branded type. This is useful for creating types that are distinct from each other even if
 * they have the same underlying structure. It also helps the TypeScript compiler to reference the type in the generated
 * declaration files, rather than inlining it.
 */
export type Branded<Type, Brand extends string> = Type & { [brand]?: Brand };
