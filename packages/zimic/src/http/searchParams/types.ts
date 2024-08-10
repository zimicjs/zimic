import { Defined, ArrayItemIfArray, IfNever, NonArrayKey, ArrayKey } from '@/types/utils';

import HttpSearchParams from './HttpSearchParams';

/** A schema for strict HTTP URL search parameters. */
export interface HttpSearchParamsSchema {
  [paramName: string]: string | string[] | undefined;
}

/** A strict tuple representation of a {@link HttpSearchParamsSchema}. */
export type HttpSearchParamsSchemaTuple<Schema extends HttpSearchParamsSchema = HttpSearchParamsSchema> = {
  [Key in keyof Schema & string]: [Key, ArrayItemIfArray<Defined<Schema[Key]>>];
}[keyof Schema & string];

/** An initialization value for {@link https://github.com/zimicjs/zimic#httpsearchparams `HttpSearchParams`}. */
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
 * param name.
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HttpSearchParamsSchemaName<Schema extends HttpSearchParamsSchema> = IfNever<
  Schema,
  never,
  keyof Schema & string
>;

type PrimitiveHttpSearchParamsSerialized<Type> = Type extends HttpSearchParamsSchema[string]
  ? Type
  : Type extends number
    ? `${number}`
    : Type extends boolean
      ? `${boolean}`
      : Type extends null
        ? undefined
        : never;

/**
 * Recursively converts a type to its URLSearchParams-serialized version. Numbers and booleans are converted to
 * `${number}` and `${boolean}` respectively, null becomes undefined and not serializable values are excluded, such as
 * functions and dates.
 */
export type HttpSearchParamsSerialized<Type> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Type extends Date | ((...parameters: any[]) => any)
    ? never
    : Type extends (infer ArrayItem)[]
      ? PrimitiveHttpSearchParamsSerialized<ArrayItem>[]
      : Type extends object
        ? {
            [Key in keyof Type as [PrimitiveHttpSearchParamsSerialized<Type[Key]>] extends [never]
              ? never
              : Key]: PrimitiveHttpSearchParamsSerialized<Type[Key]>;
          }
        : PrimitiveHttpSearchParamsSerialized<Type>;
