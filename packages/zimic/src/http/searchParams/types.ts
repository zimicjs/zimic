import { Defined, ArrayItemIfArray, ReplaceBy } from '@/types/utils';

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

export type HttpSearchParamSerialized<SearchParamValue> = SearchParamValue extends (infer ArrayItem)[]
  ? HttpSearchParamSerialized<ArrayItem>[]
  : ReplaceBy<SearchParamValue, number | boolean, `${Extract<SearchParamValue, number | boolean>}`>;
