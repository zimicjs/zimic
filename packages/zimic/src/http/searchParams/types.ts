import { Defined, ArrayItemIfArray } from '@/types/utils';

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

type PrimitiveHttpSearchParamsSerialized<Type> = Type extends HttpSearchParamsSchema[string]
  ? Type
  : Type extends number
    ? `${number}`
    : Type extends boolean
      ? `${boolean}`
      : Type extends null
        ? undefined
        : never;

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
