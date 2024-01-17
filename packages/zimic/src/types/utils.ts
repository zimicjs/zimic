export type Default<Type, IfUndefined = never> = undefined | void extends Type
  ? IfUndefined
  : Exclude<Type, undefined | void>;

export type PossiblePromise<Type> = Type | Promise<Type>;

export type NeverIfUndefined<Type> = undefined | void extends Type ? never : Type;
