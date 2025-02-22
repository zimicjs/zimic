export type Default<Type, IfEmpty = never> = [undefined | void] extends [Type]
  ? IfEmpty
  : Exclude<Type, undefined | void>;

export type DefaultNoExclude<Type, IfEmpty = never> = [undefined | void] extends Type ? IfEmpty : Type;

export type IfNever<Type, Yes, No = Type> = [Type] extends [never] ? Yes : No;

export type PossiblePromise<Type> = Type | PromiseLike<Type>;

export type ReplaceBy<Type, Source, Target> = Type extends Source ? Target : Type;
