/** Value that can be represented in JSON. */
export type LooseJSONValue =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, any> | LooseJSONValue[] | string | number | boolean | null | undefined;

export type JSONValue = { [key: string]: JSONValue } | JSONValue[] | string | number | boolean | null | undefined;

export type JSONCompatible<Type extends JSONValue> = Type;

export type JSONSerialized<Type> = Type extends string | number | boolean | null
  ? Type
  : Type extends Date
    ? string
    : Type extends undefined | ((...parameters: unknown[]) => unknown)
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
