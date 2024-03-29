type JSON = { [key: string]: JSON } | JSON[] | string | number | boolean | null | undefined;

/** Value that is compatible and can be represented in JSON. */
export type JSONValue<Type extends JSON = JSON> = Type;

export type JSONSerialized<Type> = Type extends string | number | boolean | null | undefined
  ? Type
  : Type extends Date
    ? string
    : Type extends (...parameters: unknown[]) => unknown
      ? never
      : Type extends (infer ArrayItem)[]
        ? JSONSerialized<ArrayItem>[]
        : Type extends object
          ? {
              [Key in keyof Type as [JSONSerialized<Type[Key]>] extends [never] ? never : Key]: JSONSerialized<
                Type[Key]
              >;
            }
          : never;
