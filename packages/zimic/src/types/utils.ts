export type Default<Type, IfUndefined = never> = undefined | void extends Type
  ? IfUndefined
  : Exclude<Type, undefined | void>;

export type PossiblePromise<Type> = Type | Promise<Type>;

export type NeverIfUndefined<Type> = undefined | void extends Type ? never : Type;

export type UnionToIntersection<Union> = (Union extends unknown ? (union: Union) => void : never) extends (
  intersectedUnion: infer IntersectedUnion,
) => void
  ? IntersectedUnion
  : never;

export type Prettify<Type> = {
  [Key in keyof Type]: Type[Key];
};
