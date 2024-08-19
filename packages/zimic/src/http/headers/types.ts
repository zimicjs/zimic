import { Defined, IfNever } from '@/types/utils';

import { HttpSearchParamsSerialized } from '../searchParams/types';
import HttpHeaders from './HttpHeaders';

/** A schema for strict HTTP headers. */
export interface HttpHeadersSchema {
  [headerName: string]: string | undefined;
}

/** A strict tuple representation of a {@link HttpHeadersSchema}. */
export type HttpHeadersSchemaTuple<Schema extends HttpHeadersSchema = HttpHeadersSchema> = {
  [Key in keyof Schema & string]: [Key, Defined<Schema[Key]>];
}[keyof Schema & string];

/**
 * An initialization value for
 * {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60#httpheaders `HttpHeaders`}.
 */
export type HttpHeadersInit<Schema extends HttpHeadersSchema = HttpHeadersSchema> =
  | Headers
  | Schema
  | HttpHeaders<Schema>
  | HttpHeadersSchemaTuple<Schema>[];

/**
 * Extracts the names of the headers defined in a {@link HttpHeadersSchema}. Each key is considered a header name.
 *
 * @example
 *   import { type HttpSearchParamsSerialized } from 'zimic/http';
 *
 *   type HeaderName = HttpHeadersSchemaName<{
 *     'content-type': string;
 *     'content-length'?: string;
 *   }>;
 *   // "content-type" | "content-length"
 */
export type HttpHeadersSchemaName<Schema extends HttpHeadersSchema> = IfNever<Schema, never, keyof Schema & string>;

/**
 * Recursively converts a type to its {@link https://developer.mozilla.org/docs/Web/API/Headers HTTP headers}-serialized
 * version. Numbers and booleans are converted to `${number}` and `${boolean}` respectively, null becomes undefined and
 * not serializable values are excluded, such as functions and dates.
 *
 * @example
 *   import { type HttpSearchParamsSerialized } from 'zimic/http';
 *
 *   type Params = HttpSearchParamsSerialized<{
 *     'content-type': string;
 *     'x-remaining-tries': number;
 *     'x-full'?: boolean;
 *     'x-date'?: Date;
 *     method(): void;
 *   }>;
 *   // {
 *   //   'content-type': string;
 *   //   'x-remaining-tries': `${number}`;
 *   //   'x-full'?: "false" | "true";
 *   // }
 */
export type HttpHeadersSerialized<Type> = HttpSearchParamsSerialized<Type>;
