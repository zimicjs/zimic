import { Defined, ArrayItemIfArray, IfNever, NonArrayKey, ArrayKey } from '@/types/utils';

import HttpSearchParams from './HttpSearchParams';

/** A schema for strict HTTP URL search parameters. */
export interface HttpSearchParamsSchema {
  [paramName: string]: string | string[] | undefined;
}

export namespace HttpSearchParamsSchema {
  /** A schema for loose HTTP URL search parameters. Parameter values are not strictly typed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any>;
}

/** A strict tuple representation of a {@link HttpSearchParamsSchema}. */
export type HttpSearchParamsSchemaTuple<Schema extends HttpSearchParamsSchema = HttpSearchParamsSchema> = {
  [Key in keyof Schema & string]: [Key, ArrayItemIfArray<Defined<Schema[Key]>>];
}[keyof Schema & string];

/**
 * An initialization value for
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpsearchparams `HttpSearchParams`}.
 */
export type HttpSearchParamsInit<Schema extends HttpSearchParamsSchema = HttpSearchParamsSchema> =
  | string
  | URLSearchParams
  | Schema
  | HttpSearchParams<Schema>
  | HttpSearchParamsSchemaTuple<Schema>[];

export namespace HttpSearchParamsSchemaName {
  /** Extracts the names of the search params defined in a {@link HttpSearchParamsSchema} that are arrays. */
  export type Array<Schema extends HttpSearchParamsSchema> = IfNever<Schema, never, ArrayKey<Schema> & string>;

  /** Extracts the names of the search params defined in a {@link HttpSearchParamsSchema} that are not arrays. */
  export type NonArray<Schema extends HttpSearchParamsSchema> = IfNever<Schema, never, NonArrayKey<Schema> & string>;
}

/**
 * Extracts the names of the search params defined in a {@link HttpSearchParamsSchema}. Each key is considered a search
 * param name. `HttpSearchParamsSchemaName.Array` can be used to extract the names of array search params, whereas
 * `HttpSearchParamsSchemaName.NonArray` extracts the names of non-array search params.
 *
 * @example
 *   import { type HttpSearchParamsSchemaName } from 'zimic/http';
 *
 *   type SearchParamsName = HttpSearchParamsSchemaName<{
 *     query?: string[];
 *     page?: `${number}`;
 *     perPage?: `${number}`;
 *   }>;
 *   // "query" | "page" | "perPage"
 *
 *   type ArraySearchParamsName = HttpSearchParamsSchemaName.Array<{
 *     query?: string[];
 *     page?: `${number}`;
 *     perPage?: `${number}`;
 *   }>;
 *   // "query"
 *
 *   type NonArraySearchParamsName = HttpSearchParamsSchemaName.NonArray<{
 *     query?: string[];
 *     page?: `${number}`;
 *     perPage?: `${number}`;
 *   }>;
 *   // "page" | "perPage"
 */
export type HttpSearchParamsSchemaName<Schema extends HttpSearchParamsSchema> = IfNever<
  Schema,
  never,
  keyof Schema & string
>;

type PrimitiveHttpSearchParamsSerialized<Type> = Type extends HttpSearchParamsSchema[string]
  ? Type
  : Type extends (infer ArrayItem)[]
    ? ArrayItem extends (infer _InternalArrayItem)[]
      ? never
      : PrimitiveHttpSearchParamsSerialized<ArrayItem>[]
    : Type extends number
      ? `${number}`
      : Type extends boolean
        ? `${boolean}`
        : Type extends null
          ? undefined
          : never;

/**
 * Recursively converts a type to its
 * {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams URLSearchParams}-serialized version. Numbers and
 * booleans are converted to `${number}` and `${boolean}` respectively, null becomes undefined and not serializable
 * values are excluded, such as functions and dates.
 *
 * @example
 *   import { type HttpSearchParamsSerialized } from 'zimic/http';
 *
 *   type Params = HttpSearchParamsSerialized<{
 *     query: string | null;
 *     page?: number;
 *     full?: boolean;
 *     date: Date;
 *     method: () => void;
 *   }>;
 *   // {
 *   //   query: string | undefined;
 *   //   page?: `${number}`;
 *   //   full?: "false" | "true";
 *   // }
 */
export type HttpSearchParamsSerialized<Type> = Type extends HttpSearchParamsSchema
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
                      PrimitiveHttpSearchParamsSerialized<Type[Key]>,
                      never,
                      Key
                    >]: PrimitiveHttpSearchParamsSerialized<Type[Key]>;
                  }
                : never;
