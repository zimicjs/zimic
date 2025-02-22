export type Default<Type, IfEmpty = never> = [undefined | void] extends [Type]
  ? IfEmpty
  : Exclude<Type, undefined | void>;

export type DefaultNoExclude<Type, IfEmpty = never> = [undefined | void] extends Type ? IfEmpty : Type;

export type IfNever<Type, Yes, No = Type> = [Type] extends [never] ? Yes : No;

export type PossiblePromise<Type> = Type | PromiseLike<Type>;

export type ReplaceBy<Type, Source, Target> = Type extends Source ? Target : Type;

export type Collection<Type> = Type[] | Set<Type>;

export type DeepPartial<Type> = Type extends (...parameters: never[]) => unknown
  ? Type
  : Type extends (infer ArrayItem)[]
    ? DeepPartial<ArrayItem>[]
    : Type extends object
      ? { [Key in keyof Type]?: DeepPartial<Type[Key]> }
      : Type;

export type Override<Type, OverrideType> = Omit<Type, keyof OverrideType> & OverrideType;

export interface Range<Value> {
  min: Value;
  max: Value;
}
