type JSON = { [key: string]: JSON } | JSON[] | string | number | boolean | null | undefined;

namespace JSON {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any> | Loose[] | string | number | boolean | null | undefined;
}

/**
 * Represents or validates a type that is compatible with JSON.
 *
 * @example
 *   import { type JSONValue } from 'zimic';
 *
 *   // Can be used as a standalone type:
 *   function doSomething(value: JSONValue): string {
 *     // ...
 *   }
 *
 *   // Can be used with a type argument to validate a JSON value:
 *   type ValidJSON = JSONValue<{
 *     id: string;
 *     email: string;
 *     createdAt: string;
 *   }>;
 *
 *   type InvalidJSON = JSONValue<{
 *     id: string;
 *     email: string;
 *     createdAt: Date; // `Date` is not a valid JSON value.
 *     save(): Promise<void>; // Functions are not valid JSON values.
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
 *   import { type JSONSerialized } from 'zimic';
 *
 *   type SerializedUser = JSONSerialized<{
 *     id: string;
 *     email: string;
 *     createdAt: Date;
 *     save(): Promise<void>;
 *   }>;
 *   // {
 *   //   id: string;
 *   //   email: string;
 *   //   createdAt: string;
 *   // }
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
