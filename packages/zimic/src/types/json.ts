type JSON = { [key: string]: JSON } | JSON[] | string | number | boolean | null | undefined;

/** Value that is compatible and can be represented in JSON. */
export type JSONValue<Type extends JSON = JSON> = Type;

/**
 * Recursively converts a type to its JSON-serialized version. Dates are converted to strings and non-JSON values are
 * excluded.
 */
export type JSONSerialized<Type> = Type extends string | number | boolean | null | undefined
  ? Type
  : Type extends Date
    ? string
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Type extends (...parameters: any[]) => any
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
