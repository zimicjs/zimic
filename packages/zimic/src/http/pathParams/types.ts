import { IfNever } from '@/types/utils';

export interface HttpPathParamsSchema {
  [paramName: string]: string | undefined;
}

type PrimitiveHttpPathParamsSerialized<Type> =
  Type extends Exclude<HttpPathParamsSchema[string], undefined>
    ? Type
    : Type extends (infer _ArrayItem)[]
      ? never
      : Type extends number
        ? `${number}`
        : Type extends boolean
          ? `${boolean}`
          : Type extends null
            ? undefined
            : Type extends undefined
              ? undefined
              : never;
/**
 * Recursively converts a type to its path parameters-serialized version. Numbers and booleans are converted to
 * `${number}` and `${boolean}` respectively, null becomes undefined and not serializable values are excluded, such as
 * functions and dates.
 *
 * @example
 *   import { type HttpPathParamsSerialized } from 'zimic/http';
 *
 *   type Params = HttpPathParamsSerialized<{
 *     userId: string;
 *     notificationId: number | null;
 *     full?: boolean;
 *     from?: Date;
 *     method(): void;
 *   }>;
 *   // {
 *   //   userId: string;
 *   //   notificationId: `${number}` | undefined;
 *   //   full?: "false" | "true";
 *   // }
 */
export type HttpPathParamsSerialized<Type> = Type extends HttpPathParamsSchema
  ? Type
  : Type extends (infer _ArrayItem)[]
    ? never
    : Type extends Date
      ? never
      : Type extends Function
        ? never
        : Type extends symbol
          ? never
          : Type extends Map<infer _Key, infer _Value>
            ? never
            : Type extends Set<infer _Value>
              ? never
              : Type extends object
                ? {
                    [Key in keyof Type as IfNever<
                      PrimitiveHttpPathParamsSerialized<Type[Key]>,
                      never,
                      Key
                    >]: PrimitiveHttpPathParamsSerialized<Type[Key]>;
                  }
                : never;
