export type Default<Type, IfUndefined = never> = undefined | void extends Type
  ? IfUndefined
  : Exclude<Type, undefined | void>;

export type PossiblePromise<Type> = Type | Promise<Type>;

export type NeverIfUndefined<Type> = undefined | void extends Type ? never : Type;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClassInstance<Class extends new (...parameter: any[]) => any> = Class extends new (
  ...parameters: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
) => infer Instance
  ? Instance
  : never;

export type UnionToIntersection<Union> = (Union extends unknown ? (union: Union) => void : never) extends (
  intersectedUnion: infer IntersectedUnion,
) => void
  ? IntersectedUnion
  : never;
