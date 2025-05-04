import { ArrayItemIfArray, IfNever, NonArrayKey, ArrayKey } from '@zimic/utils/types';

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
export type HttpSearchParamsSchemaTuple<Schema extends HttpSearchParamsSchema.Loose = HttpSearchParamsSchema.Loose> = {
  [Key in keyof Schema & string]: [Key, ArrayItemIfArray<NonNullable<Schema[Key]>>];
}[keyof Schema & string];

/**
 * An initialization value for
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpsearchparams `HttpSearchParams`}.
 */
export type HttpSearchParamsInit<Schema extends HttpSearchParamsSchema.Loose = HttpSearchParamsSchema.Loose> =
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
 *   import { type HttpSearchParamsSchemaName } from '@zimic/http';
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

type PrimitiveHttpSearchParamsSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends number
    ? `${number}`
    : Type extends boolean
      ? `${boolean}`
      : Type extends null
        ? 'null'
        : Type extends symbol
          ? never
          : Type extends HttpSearchParamsSchema[string]
            ? Type
            : Type extends (infer ArrayItem)[]
              ? ArrayItem extends (infer _InternalArrayItem)[]
                ? string
                : PrimitiveHttpSearchParamsSerialized<ArrayItem>[]
              : string;

/**
 * Recursively converts a schema to its
 * {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams URLSearchParams}-serialized version. Numbers,
 * booleans, and null are converted to `${number}`, `${boolean}`, and 'null' respectively, and other values become
 * strings.
 *
 * @example
 *   import { type HttpSearchParamsSerialized } from '@zimic/http';
 *
 *   type Params = HttpSearchParamsSerialized<{
 *     query?: string;
 *     order: 'asc' | 'desc' | null;
 *     page?: number;
 *     full?: boolean;
 *   }>;
 *   // {
 *   //   query?: string;
 *   //   order: 'asc' | 'desc' | 'null';
 *   //   page?: `${number}`;
 *   //   full?: "false" | "true";
 *   // }
 */
export type HttpSearchParamsSerialized<Type> = [Type] extends [never]
  ? never
  : Type extends HttpSearchParamsSchema
    ? Type
    : Type extends object
      ? {
          [Key in keyof Type as IfNever<
            PrimitiveHttpSearchParamsSerialized<Type[Key]>,
            never,
            Key
          >]: PrimitiveHttpSearchParamsSerialized<Type[Key]>;
        }
      : never;
