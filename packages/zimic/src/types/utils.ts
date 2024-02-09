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
