type JSON = { [key: string]: JSON } | JSON[] | string | number | boolean | null | undefined;

namespace JSON {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any> | Loose[] | string | number | boolean | null | undefined;
}

/**
 * Represents or validates a type that is compatible with JSON.
 *
 * **IMPORTANT**: the input of `JSONValue` and all of its internal types must be declared inline or as a type aliases
 * (`type`). They cannot be interfaces.
 *
 * @example
 *   import { type JSONValue } from '@zimic/http';
 *
 *   // Can be used as a standalone type:
 *   const value: JSONValue = {
 *     name: 'example',
 *     tags: ['one', 'two'],
 *   };
 *
 * @example
 *   import { type JSONValue } from '@zimic/http';
 *
 *   // Can be used with a type argument to validate a JSON value:
 *   type ValidJSON = JSONValue<{
 *     id: string;
 *     email: string;
 *     createdAt: string;
 *   }>;
 *
 *   // This results in a type error:
 *   type InvalidJSON = JSONValue<{
 *     id: string;
 *     email: string;
 *     createdAt: Date; // `Date` is not a valid JSON value.
 *     save: () => Promise<void>; // Functions are not valid JSON values.
 *   }>;
 */
export type JSONValue<Type extends JSON = JSON> = Type;

export namespace JSONValue {
  /** A loose version of the JSON value type. JSON objects are not strictly typed. */
  export type Loose<Type extends JSON.Loose = JSON.Loose> = Type;
}

/**
 * Recursively converts a type to its JSON-serialized version. Dates are converted to strings and keys with non-JSON
 * values are excluded.
 *
 * @example
 *   import { type JSONSerialized } from '@zimic/http';
 *
 *   type SerializedUser = JSONSerialized<{
 *     id: string;
 *     email: string;
 *     createdAt: Date;
 *     save: () => Promise<void>;
 *   }>;
 *   // {
 *   //   id: string;
 *   //   email: string;
 *   //   createdAt: string;
 *   // }
 */
export type JSONSerialized<Type> = Type extends JSONValue
  ? Type
  : Type extends string | number | boolean | null | undefined
    ? Type
    : Type extends Date
      ? string
      : Type extends (...parameters: never[]) => unknown
        ? never
        : Type extends symbol
          ? never
          : Type extends Map<infer _Key, infer _Value>
            ? Record<string, never>
            : Type extends Set<infer _Value>
              ? Record<string, never>
              : Type extends (infer ArrayItem)[]
                ? JSONSerialized<ArrayItem>[]
                : Type extends object
                  ? {
                      [Key in keyof Type as [JSONSerialized<Type[Key]>] extends [never] ? never : Key]: JSONSerialized<
                        Type[Key]
                      >;
                    }
                  : never;

declare global {
  interface JSON {
    readonly value: unique symbol;

    // eslint-disable-next-line @typescript-eslint/method-signature-style
    stringify<Value>(
      value: Value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      replacer?: ((this: any, key: string, value: Value) => any) | (number | string)[] | null,
      space?: string | number,
    ): JSONStringified<Value>;

    // eslint-disable-next-line @typescript-eslint/method-signature-style
    parse<Value>(
      text: JSONStringified<Value>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reviver?: (this: any, key: string, value: any) => any,
    ): JSONSerialized<Value>;
  }
}

export type JSONStringified<Value> = string & { [JSON.value]: JSONSerialized<Value> };
