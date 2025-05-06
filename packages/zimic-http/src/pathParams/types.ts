import { IfNever } from '@zimic/utils/types';

export interface HttpPathParamsSchema {
  [paramName: string]: string | undefined;
}

export namespace HttpPathParamsSchema {
  /** A schema for loose HTTP path parameters. Parameter values are not strictly typed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any>;
}

type PrimitiveHttpPathParamsSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends number
    ? `${number}`
    : Type extends boolean
      ? `${boolean}`
      : Type extends null
        ? 'null'
        : Type extends symbol
          ? never
          : Type extends HttpPathParamsSchema[string]
            ? Type
            : string;
/**
 * Recursively converts a schema to its path parameters-serialized version. Numbers, booleans, and null are converted to
 * `${number}`, `${boolean}`, and 'null' respectively, and other values become strings.
 *
 * @example
 *   import { type HttpPathParamsSerialized } from '@zimic/http';
 *
 *   type Params = HttpPathParamsSerialized<{
 *     userId: string;
 *     notificationId: number | null;
 *     full?: boolean;
 *   }>;
 *   // {
 *   //   userId: string;
 *   //   notificationId: `${number}` | 'null';
 *   //   full?: "false" | "true";
 *   // }
 */
export type HttpPathParamsSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends HttpPathParamsSchema
    ? Type
    : Type extends object
      ? {
          [Key in keyof Type as IfNever<
            PrimitiveHttpPathParamsSerialized<Type[Key]>,
            never,
            Key
          >]: PrimitiveHttpPathParamsSerialized<Type[Key]>;
        }
      : never;
